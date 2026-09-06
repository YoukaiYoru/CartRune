package media

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Options configures the media proxy service.
type Options struct {
	CacheDir string // directory where fetched images are cached on disk

	// ScreenScraper developer credentials (kept server-side only).
	DevID        string
	DevPassword  string
	SoftName     string
	UserID       string
	UserPassword string

	// MinDelay throttles calls to ScreenScraper between media downloads.
	// The disk cache prevents repeat traffic once an image has been fetched.
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
// are embedded in the original media URLs. Images are cached on disk.
type Service struct {
	cacheDir string
	db       *gorm.DB

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
		cacheDir:   opts.CacheDir,
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

	u := s.buildGameURL(systemID, gameID, mediaKey)
	return s.serve(c, u)
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

// serve fetches (or reads from cache) the media behind url and streams it to
// the client as an image.
func (s *Service) serve(c fiber.Ctx, mediaURL string) error {
	ctx := c.Context() // standard library context in Fiber v3

	hash := sha256.Sum256([]byte(mediaURL))
	cacheKey := hex.EncodeToString(hash[:])
	bodyPath := filepath.Join(s.cacheDir, cacheKey)
	ctypePath := bodyPath + ".ctype"

	// Fast path: already cached on disk.
	body, ctype, err := readCached(bodyPath, ctypePath)
	if err == nil {
		c.Set(fiber.HeaderContentType, ctype)
		return c.Send(body)
	}

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

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return fiber.NewError(fiber.StatusBadGateway, "failed to read media")
	}
	if isNoMedia(data) {
		return fiber.NewError(fiber.StatusNotFound, "media not found")
	}

	ctype = resp.Header.Get("Content-Type")
	if ctype == "" {
		ctype = http.DetectContentType(data)
	}

	// Persist to the on-disk cache for subsequent requests.
	if err := os.MkdirAll(s.cacheDir, 0o755); err == nil {
		_ = os.WriteFile(bodyPath, data, 0o644)
		_ = os.WriteFile(ctypePath, []byte(ctype), 0o644)
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

func readCached(bodyPath, ctypePath string) ([]byte, string, error) {
	body, err := os.ReadFile(bodyPath)
	if err != nil {
		return nil, "", err
	}
	ct, err := os.ReadFile(ctypePath)
	if err != nil {
		return nil, "", err
	}
	return body, string(ct), nil
}

// isNoMedia reports whether ScreenScraper answered NOMEDIA (no media found).
func isNoMedia(body []byte) bool {
	return bytes.Contains(body, []byte("NOMEDIA"))
}
