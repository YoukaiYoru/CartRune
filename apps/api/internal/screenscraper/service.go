package screenscraper

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/YoukaiYoru/api/internal/media"
	"github.com/YoukaiYoru/api/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Service provides higher-level operations over the ScreenScraper client and
// the local catalog.
type Service struct {
	client      *Client
	db          *gorm.DB
	cacheTTL    time.Duration
	mu          sync.RWMutex
	searchCache map[string]searchCacheEntry
	detailCache map[string]detailCacheEntry
}

type ServiceOptions struct {
	CacheTTL time.Duration
}

type searchCacheEntry struct {
	items     []SearchItem
	expiresAt time.Time
}

type detailCacheEntry struct {
	detail    *DetailResponse
	expiresAt time.Time
}

// ImportByQuery enriches the local catalog for scanner fallback. It never
// adds the imported game to a user's library.
func (s *Service) ImportByQuery(ctx context.Context, query, platformHint string) (string, error) {
	if lines := strings.Split(query, "\n"); len(lines) > 0 {
		query = strings.TrimSpace(lines[0])
	}
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, query)
	if len(digits) >= 8 {
		if game, err := s.client.SearchByRomName(ctx, digits); err == nil && game != nil {
			result, importErr := s.Import(ctx, game.IDInt(), "", "")
			if importErr != nil {
				return "", importErr
			}
			return result.GameID, nil
		}
	}
	items, err := s.Search(ctx, SearchRequest{Query: query})
	if err != nil || len(items) == 0 {
		if err == nil {
			err = ErrNotFound
		}
		return "", err
	}
	selected := items[0]
	if platformHint != "" {
		for _, item := range items {
			if strings.Contains(strings.ToLower(item.SystemName), strings.ToLower(platformHint)) {
				selected = item
				break
			}
		}
	}
	result, err := s.Import(ctx, selected.GameID, selected.Region, "")
	if err != nil {
		return "", err
	}
	return result.GameID, nil
}

func NewService(client *Client, db *gorm.DB) *Service {
	return NewServiceWithOptions(client, db, ServiceOptions{})
}

func NewServiceWithOptions(client *Client, db *gorm.DB, opts ServiceOptions) *Service {
	if opts.CacheTTL <= 0 {
		opts.CacheTTL = 2 * time.Minute
	}
	return &Service{
		client:      client,
		db:          db,
		cacheTTL:    opts.CacheTTL,
		searchCache: make(map[string]searchCacheEntry),
		detailCache: make(map[string]detailCacheEntry),
	}
}

// Search queries ScreenScraper by name and normalizes the results into
// candidates with a cover URL. systemeID is optional (a hint to narrow search).
func (s *Service) Search(ctx context.Context, req SearchRequest) ([]SearchItem, error) {
	req.Query = strings.TrimSpace(req.Query)
	if req.Query == "" || len([]rune(req.Query)) > 120 {
		return nil, ErrInvalidQuery
	}
	key := fmt.Sprintf("%s|%d|%s|%s", strings.ToLower(req.Query), req.SystemeID, req.Region, req.Language)
	now := time.Now()
	s.mu.RLock()
	if cached, ok := s.searchCache[key]; ok && now.Before(cached.expiresAt) {
		items := append([]SearchItem(nil), cached.items...)
		s.mu.RUnlock()
		return items, nil
	}
	s.mu.RUnlock()

	results, err := s.client.SearchByName(ctx, req.Query, req.SystemeID)
	if err != nil {
		return nil, err
	}

	items := make([]SearchItem, 0, len(results))
	for _, g := range results {
		if ok, _ := g.OfficialContent(); !ok {
			continue
		}
		item := SearchItem{
			GameID:      g.IDInt(),
			Title:       g.NormalizedTitle(req.Region),
			SystemName:  g.Systeme.Text,
			SystemID:    atoi(g.Systeme.ID),
			Region:      pickRegion(req.Region),
			ReleaseDate: g.ReleaseDate(req.Region),
			CoverURL:    coverProxyURL(g, req.Region),
			Synopsis:    g.GetSynopsis(req.Language),
			Note:        g.NoteScore(),
		}
		item.Official, item.FilteredOut = g.OfficialContent()
		items = append(items, item)
	}
	s.mu.Lock()
	s.searchCache[key] = searchCacheEntry{items: append([]SearchItem(nil), items...), expiresAt: time.Now().Add(s.cacheTTL)}
	s.mu.Unlock()
	return items, nil
}

// Detail fetches full info and media for a given game id, normalized.
func (s *Service) Detail(ctx context.Context, gameID int, region, language string) (*DetailResponse, error) {
	if gameID <= 0 {
		return nil, ErrInvalidQuery
	}
	key := fmt.Sprintf("%d|%s|%s", gameID, region, language)
	now := time.Now()
	s.mu.RLock()
	if cached, ok := s.detailCache[key]; ok && now.Before(cached.expiresAt) {
		detail := cached.detail
		s.mu.RUnlock()
		return detail, nil
	}
	s.mu.RUnlock()

	g, err := s.client.GameDetail(ctx, gameID)
	if err != nil {
		return nil, err
	}

	res := &DetailResponse{
		GameID:      g.IDInt(),
		Title:       g.NormalizedTitle(region),
		Description: g.GetSynopsis(language),
		Developer:   g.Developpeur.Text,
		Publisher:   g.Editeur.Text,
		ReleaseDate: g.ReleaseDate(region),
		Players:     g.PlayerCount(),
		Note:        g.NoteScore(),
		System:      g.Systeme.Text,
		SystemID:    atoi(g.Systeme.ID),
		CoverURL:    coverProxyURL(g, region),
	}
	res.Official, res.FilteredOut = g.OfficialContent()

	// All media exposed through the proxy for the game: images AND videos.
	// Grouped by coarse kind (2d/3d/screenshot/logo/video/...) so clients can
	// render a media gallery without knowing every ScreenScraper token. URLs
	// point to the media proxy so credentials never reach clients.
	systemID := atoi(g.Systeme.ID)
	for i := range g.Medias {
		m := &g.Medias[i]
		res.Media = append(res.Media, MediaData{
			Key:    m.Type,
			URL:    media.GameMediaPath(systemID, g.IDInt(), m.Token()),
			Kind:   mediaKind(m.Type),
			Region: m.Region,
		})
	}

	// Image covers grouped by media token for review/testing; URLs point
	// to the media proxy so ScreenScraper credentials never reach clients.
	for i := range g.Medias {
		m := &g.Medias[i]
		if !isImageMedia(m) {
			continue
		}
		res.Covers = append(res.Covers, CoverData{
			Key:    m.Type,
			URL:    media.GameMediaPath(systemID, g.IDInt(), m.Token()),
			Kind:   coverKind(m.Type),
			Region: m.Region,
		})
	}
	s.mu.Lock()
	s.detailCache[key] = detailCacheEntry{detail: res, expiresAt: time.Now().Add(s.cacheTTL)}
	s.mu.Unlock()
	return res, nil
}

// Import fetches a game by id and persists it into the local catalog, applying
// the official-content filter. When the game already exists it is skipped.
func (s *Service) Import(ctx context.Context, gameID int, region, language string) (*ImportResponse, error) {
	g, err := s.client.GameDetail(ctx, gameID)
	if err != nil {
		return nil, err
	}

	// Reject non-official content based on the ROM flags.
	if ok, reason := g.OfficialContent(); !ok {
		return nil, fmt.Errorf("%w: %s", ErrFiltered, reason)
	}

	title := g.NormalizedTitle(region)
	slug := slugify(title)

	// Skip if a game with the same slug already exists.
	var existing models.Game
	if err := s.db.Where("slug = ?", slug).First(&existing).Error; err == nil {
		return &ImportResponse{GameID: existing.ID.String(), Title: existing.Title, Created: false}, nil
	}

	game := models.Game{
		ID:          uuid.New(),
		Title:       title,
		Slug:        slug,
		Description: g.GetSynopsis(language),
		Developer:   g.Developpeur.Text,
		Publisher:   g.Editeur.Text,
	}
	if d := g.ReleaseDate(region); d != "" {
		if t, perr := time.Parse("2006-01-02", d); perr == nil {
			game.ReleaseDate = &t
		}
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&game).Error; err != nil {
			return err
		}

		// Platform (create or reuse by name). The ID is pre-assigned so a
		// FirstOrCreate on a missing platform does not insert a zero UUID.
		platform := models.Platform{
			ID:   uuid.New(),
			Name: g.Systeme.Text,
			Slug: slugify(g.Systeme.Text),
		}
		if sysID := atoi(g.Systeme.ID); sysID > 0 {
			platform.Slug = slugify(fmt.Sprintf("%s-%d", g.Systeme.Text, sysID))
		}
		if err := tx.Where("slug = ?", platform.Slug).FirstOrCreate(&platform).Error; err != nil {
			return err
		}
		if err := tx.Model(&game).Association("Platforms").Append(&platform); err != nil {
			return err
		}

		// Release.
		release := models.Release{
			ID:         uuid.New(),
			GameID:     game.ID,
			PlatformID: platform.ID,
			Region:     pickRegion(region),
			Barcode:    extractBarcode(g),
			Physical:   true,
			Official:   true,
		}
		if g.ReleaseDate(region) != "" {
			if t, perr := time.Parse("2006-01-02", g.ReleaseDate(region)); perr == nil {
				release.ReleaseDate = &t
			}
		}
		if err := tx.Create(&release).Error; err != nil {
			return err
		}

		// Persist every image media (box-2D, box-3D, textures, logos, fanart,
		// screenshots and per-region variants). URLs are sanitized: the
		// ScreenScraper credentials are stripped and only re-attached by the
		// media proxy at fetch time. The primary box/support cover is flagged.
		primary := g.PrimaryMediaItem(region)
		for i := range g.Medias {
			m := &g.Medias[i]
			if !isImageMedia(m) {
				continue
			}
			cover := models.Cover{
				ID:      uuid.New(),
				GameID:  game.ID,
				URL:     media.SanitizeSSURL(m.URL),
				Region:  m.Region,
				Type:    m.Type,
				Source:  "screenscraper",
				Primary: primary != nil && m.URL == primary.URL,
			}
			if err := tx.Create(&cover).Error; err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return &ImportResponse{GameID: game.ID.String(), Title: game.Title, Created: true}, nil
}

// coverProxyURL returns the media proxy path for the primary cover of g,
// preferring the requested region. It never exposes ScreenScraper credentials.
func coverProxyURL(g *GameInfo, region string) string {
	if g == nil {
		return ""
	}
	if m := g.PrimaryMediaItem(region); m != nil {
		return media.GameMediaPath(atoi(g.Systeme.ID), g.IDInt(), m.Token())
	}
	return ""
}

func coverKind(key string) string {
	switch {
	case strings.Contains(key, "3d"):
		return "3d"
	case strings.Contains(key, "2d"):
		return "2d"
	case strings.Contains(key, "texture"):
		return "texture"
	}
	return "other"
}

// mediaKind classifies any ScreenScraper media token (images and videos) into
// a coarse kind consumable by the mobile media gallery.
func mediaKind(key string) string {
	t := strings.ToLower(strings.TrimSpace(key))
	switch {
	case strings.Contains(t, "video"):
		return "video"
	case strings.Contains(t, "screenshot"):
		return "screenshot"
	case strings.Contains(t, "logo"):
		return "logo"
	case strings.Contains(t, "fanart"):
		return "fanart"
	case strings.Contains(t, "wheel"):
		return "wheel"
	case strings.Contains(t, "manuel"):
		return "manual"
	case strings.Contains(t, "3d"):
		return "3d"
	case strings.Contains(t, "2d"):
		return "2d"
	case strings.Contains(t, "texture"):
		return "texture"
	}
	return "other"
}

// extractBarcode does a best-effort extraction of the physical EAN/UPC from the
// ROM blocks. ScreenScraper exposes barcodes as images, not text, so the ROM
// serial is the only textual source; numeric codes of valid length win.
func extractBarcode(g *GameInfo) string {
	for _, rom := range g.Roms {
		if rom == nil {
			continue
		}
		serial := strings.TrimSpace(rom.Serial)
		digits := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, serial)
		if len(digits) == 12 || len(digits) == 13 {
			return digits
		}
	}
	return ""
}

// atoi parses a ScreenScraper string id into an int, returning 0 when unset.
func atoi(s string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}

func pickRegion(r string) string {
	switch r {
	case "eu", "us", "jp", "fr", "es", "wor", "ss":
		return r
	default:
		return ""
	}
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	var b strings.Builder
	lastDash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastDash = false
		case r >= '\u00e0' && r <= '\u00ff': // Latin-1 letters (accented)
			b.WriteRune(r)
			lastDash = false
		default:
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		out = "game"
	}
	return out
}
