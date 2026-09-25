package screenscraper

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/YoukaiYoru/api/internal/media"
	"github.com/YoukaiYoru/api/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	var items []SearchItem
	var err error
	systemID := screenScraperSystemID(platformHint)
	for _, candidate := range searchQueryVariants(query) {
		items, err = s.Search(ctx, SearchRequest{Query: candidate, SystemeID: systemID})
		if err == nil && len(items) > 0 {
			break
		}
	}
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
	var result *ImportResponse
	if selected.source != nil {
		// jeuRecherche returns the game metadata and media (without ROM blocks),
		// which is enough for a cover import and avoids a quota-expensive detail
		// request that can return 404 for a valid game id/system pair.
		result, err = s.importGameInfo(ctx, selected.source, selected.Region, "")
	} else {
		result, err = s.importWithSystem(ctx, selected.GameID, selected.SystemID, selected.Region, "")
	}
	if err != nil {
		return "", err
	}
	return result.GameID, nil
}

// screenScraperSystemID maps the platform names produced by OCR/vision to the
// numeric identifiers expected by jeuRecherche.php. Unknown platforms remain
// unfiltered so the provider can still return a useful candidate.
func screenScraperSystemID(platform string) int {
	normalized := strings.ToLower(strings.TrimSpace(platform))
	switch {
	case strings.Contains(normalized, "nintendo ds") || normalized == "nds":
		return 15
	case strings.Contains(normalized, "mega drive") || strings.Contains(normalized, "megadrive") || strings.Contains(normalized, "genesis"):
		return 1
	default:
		return 0
	}
}

// searchQueryVariants handles title punctuation that ScreenScraper treats as
// meaningful. Vision models often omit the separator in titles such as
// "Final Fantasy - The 4 Heroes Of Light", even though the provider indexes
// the hyphenated form. Keep the original first, then try conservative
// punctuation variants without inventing words.
func searchQueryVariants(query string) []string {
	query = strings.Join(strings.Fields(query), " ")
	if query == "" {
		return nil
	}
	variants := []string{query}
	add := func(value string) {
		value = strings.Join(strings.Fields(value), " ")
		if value == "" {
			return
		}
		for _, existing := range variants {
			if strings.EqualFold(existing, value) {
				return
			}
		}
		variants = append(variants, value)
	}
	add(strings.ReplaceAll(query, ":", " -"))
	add(strings.ReplaceAll(query, ":", " - "))
	// Vision models can read the numeral in this title as "IV" and omit the
	// article/separator used by ScreenScraper. Keep this normalization narrow
	// and deterministic instead of asking the provider for many fuzzy queries.
	if strings.Contains(strings.ToLower(query), "final fantasy") && strings.Contains(strings.ToLower(query), "heroes of light") {
		add("Final Fantasy - The 4 Heroes of Light")
	}
	words := strings.Fields(query)
	for i, word := range words {
		if strings.EqualFold(word, "iv") {
			copyWords := append([]string(nil), words...)
			copyWords[i] = "4"
			add(strings.Join(copyWords, " "))
		}
	}
	if index := strings.Index(strings.ToLower(query), " the "); index > 0 {
		add(query[:index] + " -" + query[index:])
		add(query[:index] + " - " + query[index+1:])
	}
	return variants
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
		// ScreenScraper can occasionally return an empty object with HTTP 200
		// while a search is being throttled or the query has no usable result.
		// Never expose that placeholder as a candidate: it would later become
		// gameid=0 and produce a misleading jeuInfos.php 404.
		if g == nil || g.IDInt() <= 0 || strings.TrimSpace(g.Title(req.Region)) == "" || g.Systeme.ID == "" {
			continue
		}
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
		item.source = g
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
// the official-content filter. It is idempotent and safe when two scanner
// requests import the same provider result concurrently.
func (s *Service) Import(ctx context.Context, gameID int, region, language string) (*ImportResponse, error) {
	return s.importWithSystem(ctx, gameID, 0, region, language)
}

func (s *Service) importWithSystem(ctx context.Context, gameID, systemID int, region, language string) (*ImportResponse, error) {
	g, err := s.client.GameDetailForSystem(ctx, gameID, systemID)
	if err != nil {
		return nil, err
	}
	return s.importGameInfo(ctx, g, region, language)
}

func (s *Service) importGameInfo(ctx context.Context, g *GameInfo, region, language string) (*ImportResponse, error) {
	if g == nil || g.IDInt() <= 0 || g.Systeme.ID == "" {
		return nil, ErrNotFound
	}
	// Reject non-official content based on the ROM flags.
	if ok, reason := g.OfficialContent(); !ok {
		return nil, fmt.Errorf("%w: %s", ErrFiltered, reason)
	}

	title := g.NormalizedTitle(region)
	slug := slugify(title)

	gameInput := models.Game{
		ID:          uuid.New(),
		Title:       title,
		Slug:        slug,
		Description: g.GetSynopsis(language),
		Developer:   g.Developpeur.Text,
		Publisher:   g.Editeur.Text,
	}
	if d := g.ReleaseDate(region); d != "" {
		if t, perr := time.Parse("2006-01-02", d); perr == nil {
			gameInput.ReleaseDate = &t
		}
	}

	createdGame := false
	var game models.Game
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		// FirstOrCreate is racy under concurrent scanner requests. The unique
		// slug plus ON CONFLICT makes this operation safe and idempotent.
		err := tx.Where("slug = ?", slug).First(&game).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			result := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "slug"}},
				DoNothing: true,
			}).Create(&gameInput)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				if err := tx.Where("slug = ?", slug).First(&game).Error; err != nil {
					return err
				}
			} else {
				game = gameInput
				createdGame = true
			}
		} else if err != nil {
			return err
		}

		// Platforms have a unique slug. Use the same conflict-safe pattern so
		// parallel imports cannot fail on idx_platforms_slug.
		platformName := g.Systeme.Text
		platformSlug := slugify(platformName)
		if sysID := atoi(g.Systeme.ID); sysID > 0 {
			platformSlug = slugify(fmt.Sprintf("%s-%d", platformName, sysID))
		}
		// Query into an empty model. If a generated UUID is already present,
		// GORM adds it to the WHERE clause and misses an existing slug.
		var platform models.Platform
		err = tx.Where("slug = ?", platformSlug).First(&platform).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			platform = models.Platform{
				ID:   uuid.New(),
				Name: platformName,
				Slug: platformSlug,
			}
			result := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "slug"}},
				DoNothing: true,
			}).Create(&platform)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				if err := tx.Where("slug = ?", platform.Slug).First(&platform).Error; err != nil {
					return err
				}
			}
		} else if err != nil {
			return err
		}

		link := models.GamePlatform{GameID: game.ID, PlatformID: platform.ID}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&link).Error; err != nil {
			return err
		}

		// Reuse the release for the same game/platform/region, otherwise add
		// the missing release to an already-imported game.
		releaseRegion := pickRegion(region)
		barcode := extractBarcode(g)
		var release models.Release
		releaseQuery := tx.Where("game_id = ? AND platform_id = ? AND region = ?", game.ID, platform.ID, releaseRegion)
		if barcode != "" {
			releaseQuery = releaseQuery.Where("barcode = ? OR barcode = ''", barcode)
		}
		releaseErr := releaseQuery.First(&release).Error
		if errors.Is(releaseErr, gorm.ErrRecordNotFound) {
			release = models.Release{
				ID:         uuid.New(),
				GameID:     game.ID,
				PlatformID: platform.ID,
				Region:     releaseRegion,
				Barcode:    barcode,
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
		} else if releaseErr != nil {
			return releaseErr
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
				ID:        uuid.New(),
				GameID:    game.ID,
				ReleaseID: release.ID,
				URL:       media.SanitizeSSURL(m.URL),
				Region:    m.Region,
				Type:      m.Type,
				Source:    "screenscraper",
				Primary:   primary != nil && m.URL == primary.URL,
			}
			var existingCover models.Cover
			coverErr := tx.Where("game_id = ? AND release_id = ? AND url = ?", cover.GameID, cover.ReleaseID, cover.URL).First(&existingCover).Error
			if errors.Is(coverErr, gorm.ErrRecordNotFound) {
				if err := tx.Create(&cover).Error; err != nil {
					return err
				}
			} else if coverErr != nil {
				return coverErr
			}
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return &ImportResponse{GameID: game.ID.String(), Title: game.Title, Created: createdGame}, nil
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
