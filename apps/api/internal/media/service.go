package media

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Options configures the media proxy service.
type Options struct {
	// ScreenScraper developer credentials (kept server-side only).
	DevID        string
	DevPassword  string
	SoftName     string
	UserID       string
	UserPassword string

	// MinDelay throttles calls to ScreenScraper between media downloads.
	MinDelay time.Duration

	// RateLimit and RateWindow control the per-IP request cap for the public
	// media proxy (e.g. RateLimit=30 per RateWindow=time.Minute). Zero/negative
	// disables the rate limit.
	RateLimit  int
	RateWindow time.Duration

	DB *gorm.DB
}

// Service proxies ScreenScraper media (box art, 3D boxes, logos, ...) to the
// CartRune clients without ever exposing the ScreenScraper credentials that
// are embedded in the original media URLs. Media is streamed and never
// persisted by this service.
type Service struct {
	db *gorm.DB

	devID    string
	devPass  string
	softName string
	ssID     string
	ssPass   string

	client   *http.Client
	minDelay time.Duration

	// per-IP rate limiting
	rlMu       sync.Mutex
	rlLimit    int
	rlWindow   time.Duration
	rlLastSeen map[string]time.Time
	rlCounts   map[string]int

	throttleMu sync.Mutex
	lastReq    time.Time
}

// NewService builds a MediaService.
func NewService(opts Options) *Service {
	if opts.MinDelay <= 0 {
		opts.MinDelay = 500 * time.Millisecond
	}
	if opts.RateLimit <= 0 {
		opts.RateLimit = 0
	}
	if opts.RateWindow <= 0 {
		opts.RateWindow = time.Minute
	}
	return &Service{
		db:         opts.DB,
		devID:      opts.DevID,
		devPass:    opts.DevPassword,
		softName:   opts.SoftName,
		ssID:       opts.UserID,
		ssPass:     opts.UserPassword,
		client:     &http.Client{Timeout: 30 * time.Second},
		minDelay:   opts.MinDelay,
		rlLimit:    opts.RateLimit,
		rlWindow:   opts.RateWindow,
		rlCounts:   map[string]int{},
		rlLastSeen: map[string]time.Time{},
	}
}

// RateLimit returns a middleware that caps per-IP requests to the public media
// proxy, protecting the ScreenScraper quota from automated abuse.
func (s *Service) RateLimit() fiber.Handler {
	return func(c fiber.Ctx) error {
		if s.rlLimit <= 0 {
			return c.Next()
		}
		ip := c.IP()
		if s.db != nil {
			allowed, err := s.consumeDistributedLimit(c.Context(), ip)
			if err != nil {
				return fiber.NewError(fiber.StatusServiceUnavailable, "rate limiter unavailable")
			}
			if !allowed {
				return fiber.NewError(fiber.StatusTooManyRequests, "too many media requests")
			}
			return c.Next()
		}
		now := time.Now()

		s.rlMu.Lock()
		if seen, ok := s.rlLastSeen[ip]; ok && now.Sub(seen) >= s.rlWindow {
			s.rlCounts[ip] = 0
		}
		s.rlLastSeen[ip] = now
		s.rlCounts[ip]++
		if s.rlCounts[ip] > s.rlLimit {
			s.rlMu.Unlock()
			return fiber.NewError(fiber.StatusTooManyRequests, "too many media requests")
		}
		s.rlMu.Unlock()
		return c.Next()
	}
}

func (s *Service) consumeDistributedLimit(ctx context.Context, ip string) (bool, error) {
	digest := sha256.Sum256([]byte(ip))
	key := "media:" + hex.EncodeToString(digest[:])
	now := time.Now()
	allowed := false
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var bucket models.RateLimitBucket
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&bucket, "key = ?", key).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			bucket = models.RateLimitBucket{Key: key, WindowStartedAt: now, Count: 1}
			allowed = true
			return tx.Create(&bucket).Error
		}
		if err != nil {
			return err
		}
		if now.Sub(bucket.WindowStartedAt) >= s.rlWindow {
			bucket.WindowStartedAt = now
			bucket.Count = 1
		} else {
			bucket.Count++
		}
		allowed = bucket.Count <= s.rlLimit
		return tx.Save(&bucket).Error
	})
	return allowed, err
}

// ServeCover handles GET /media/covers/:id for a persisted cover.
func (s *Service) ServeCover(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid cover id")
	}

	var cover models.Cover
	if err := s.db.First(&cover, "id = ?", id).Error; err != nil {
		return fiber.NewError(fiber.StatusNotFound, "cover not found")
	}

	u := s.fullURL(cover.URL)
	if u == "" {
		return fiber.NewError(fiber.StatusInternalServerError, "invalid stored cover url")
	}
	return s.serve(c, u)
}

// ServeGameMedia handles GET /media/games/:systemeid/:jeuid for a
// ScreenScraper media token passed as ?media= (e.g. "box-2D(eu)").
func (s *Service) ServeGameMedia(c fiber.Ctx) error {
	systemID, err := strconv.Atoi(c.Params("systemeid"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid system id")
	}
	gameID, err := strconv.Atoi(c.Params("jeuid"))
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid game id")
	}
	mediaKey := c.Query("media")
	if mediaKey == "" {
		return fiber.NewError(fiber.StatusBadRequest, "media query parameter is required")
	}
	if !allowedMediaKey(mediaKey) {
		return fiber.NewError(fiber.StatusBadRequest, "unsupported media type")
	}

	u := s.buildGameURL(systemID, gameID, mediaKey)
	return s.serve(c, u)
}

func allowedMediaKey(key string) bool {
	key = strings.ToLower(strings.TrimSpace(key))
	for _, prefix := range []string{"box-2d", "box-3d", "box-texture", "support-2d", "support-texture", "fanart", "wheel", "screenshot", "logo"} {
		if strings.HasPrefix(key, prefix) {
			return true
		}
	}
	return false
}

// CleanupStoredURLs removes the ScreenScraper credentials that may have been
// persisted in covers.url before the proxy was introduced.
func (s *Service) CleanupStoredURLs(ctx context.Context) error {
	var covers []models.Cover
	if err := s.db.WithContext(ctx).Find(&covers).Error; err != nil {
		return err
	}
	for _, cv := range covers {
		cleaned := SanitizeSSURL(cv.URL)
		if cleaned != cv.URL {
			if err := s.db.WithContext(ctx).Model(&models.Cover{}).
				Where("id = ?", cv.ID).Update("url", cleaned).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// fullURL re-attaches the developer credentials to a stored (sanitized)
// ScreenScraper media URL.
func (s *Service) fullURL(sanitized string) string {
	u, err := url.Parse(sanitized)
	if err != nil {
		return ""
	}
	q := u.Query()
	s.fillCreds(q)
	q.Del("output")
	u.RawQuery = q.Encode()
	return u.String()
}

// buildGameURL constructs a ScreenScraper media URL for a game/media key.
func (s *Service) buildGameURL(systemID, gameID int, mediaKey string) string {
	u, _ := url.Parse("https://api.screenscraper.fr/api2/mediaJeu.php")
	q := u.Query()
	s.fillCreds(q)
	q.Set("systemeid", strconv.Itoa(systemID))
	q.Set("jeuid", strconv.Itoa(gameID))
	q.Set("media", mediaKey)
	u.RawQuery = q.Encode()
	return u.String()
}

// fillCreds puts the developer (and optional user) credentials into q.
func (s *Service) fillCreds(q url.Values) {
	q.Set("devid", s.devID)
	q.Set("devpassword", s.devPass)
	q.Set("softname", s.softName)
	if s.ssID != "" {
		q.Set("ssid", s.ssID)
		q.Set("sspassword", s.ssPass)
	}
}

// serve fetches the media behind url and streams it to the client. The body is
// held only transiently in memory for validation; it is never written to disk
// or persisted in the database.
func (s *Service) serve(c fiber.Ctx, mediaURL string) error {
	ctx := c.Context() // standard library context in Fiber v3

	s.throttle()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, mediaURL, nil)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to build media request")
	}
	req.Header.Set("User-Agent", "CartRune/0.1")
	req.Header.Set("Referer", "https://screenscraper.fr/membreinfos.php")

	resp, err := s.client.Do(req)
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, "failed to fetch media")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return fiber.NewError(fiber.StatusNotFound, "media not found")
	}
	if resp.StatusCode != http.StatusOK {
		return fiber.NewError(fiber.StatusBadGateway, "media fetch failed")
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024+1))
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, "failed to read media")
	}
	if len(data) > 10*1024*1024 {
		return fiber.NewError(fiber.StatusBadGateway, "media response too large")
	}
	if isNoMedia(data) {
		return fiber.NewError(fiber.StatusNotFound, "media not found")
	}

	ctype := resp.Header.Get("Content-Type")
	if ctype == "" {
		ctype = http.DetectContentType(data)
	}
	if !strings.HasPrefix(strings.ToLower(ctype), "image/") && !strings.HasPrefix(strings.ToLower(ctype), "video/") {
		return fiber.NewError(fiber.StatusBadGateway, "unsupported media content type")
	}

	c.Set(fiber.HeaderContentType, ctype)
	return c.Send(data)
}

func (s *Service) throttle() {
	s.throttleMu.Lock()
	defer s.throttleMu.Unlock()
	if since := time.Since(s.lastReq); since < s.minDelay {
		time.Sleep(s.minDelay - since)
	}
	s.lastReq = time.Now()
}

// isNoMedia reports whether ScreenScraper answered NOMEDIA (no media found).
func isNoMedia(body []byte) bool {
	return bytes.Contains(body, []byte("NOMEDIA"))
}
