package screenscraper

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
)

// SearchByName calls jeuRecherche.php and returns up to 30 games ordered by
// probability. systemeID is optional (0 to ignore).
func (c *Client) SearchByName(ctx context.Context, name string, systemeID int) ([]*GameInfo, error) {
	q := c.baseQuery()
	q.Set("recherche", name)
	if systemeID > 0 {
		q.Set("systemeid", strconv.Itoa(systemeID))
	}

	var res APIResponse
	status, err := c.get(ctx, "jeuRecherche.php", q, &res)
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		return nil, ErrNotFound
	}
	if res.Header.Error != "" {
		return nil, classifyProviderError(res.Header.Error)
	}
	return res.Response.Jeux, nil
}

// SearchByRomName uses ScreenScraper's ROM-name lookup. It is the provider
// supported path for barcode/serial fallback when the local catalog misses.
func (c *Client) SearchByRomName(ctx context.Context, romName string) (*GameInfo, error) {
	q := c.baseQuery()
	q.Set("romnom", romName)
	q.Set("romtype", "rom")

	var res APIResponse
	status, err := c.get(ctx, "jeuInfos.php", q, &res)
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		return nil, ErrNotFound
	}
	if res.Header.Error != "" {
		return nil, classifyProviderError(res.Header.Error)
	}
	if res.Response.Jeu == nil {
		return nil, ErrNotFound
	}
	return res.Response.Jeu, nil
}

// GameDetail calls jeuInfos.php forcing the search by numeric game id.
func (c *Client) GameDetail(ctx context.Context, gameID int) (*GameInfo, error) {
	return c.GameDetailForSystem(ctx, gameID, 0)
}

// GameDetailForSystem fetches a game with an optional ScreenScraper system id.
// Some provider nodes resolve a game id more reliably when both identifiers
// are present, especially for multi-platform titles.
func (c *Client) GameDetailForSystem(ctx context.Context, gameID, systemID int) (*GameInfo, error) {
	q := c.baseQuery()
	q.Set("gameid", strconv.Itoa(gameID))

	var res APIResponse
	status, err := c.get(ctx, "jeuInfos.php", q, &res)
	if err == nil && status == http.StatusOK && res.Header.Error == "" && res.Response.Jeu != nil {
		return res.Response.Jeu, nil
	}
	if err != nil && !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	if res.Header.Error != "" {
		err = classifyProviderError(res.Header.Error)
	}
	if err == nil || status == http.StatusNotFound {
		err = ErrNotFound
	}

	// ScreenScraper documents gameid as sufficient for jeuInfos.php. Some
	// provider nodes historically required systemeid as well, so keep a single
	// compatibility retry, but never make it the primary request.
	if systemID <= 0 || !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	q.Set("systemeid", strconv.Itoa(systemID))
	res = APIResponse{}
	status, retryErr := c.get(ctx, "jeuInfos.php", q, &res)
	if retryErr != nil {
		return nil, retryErr
	}
	if status == http.StatusNotFound || res.Response.Jeu == nil {
		return nil, ErrNotFound
	}
	if res.Header.Error != "" {
		return nil, classifyProviderError(res.Header.Error)
	}
	return res.Response.Jeu, nil
}

// ID returns the numeric game id, or 0 when unset/not numeric.
func (g *GameInfo) IDInt() int {
	if g == nil {
		return 0
	}
	n, _ := strconv.Atoi(g.ID)
	return n
}

// Title returns the game title favouring a preferred region (e.g. "eu", "us",
// "es", "wor"), falling back to the "ss" region then any first title.
func (g *GameInfo) Title(region string) string {
	if g == nil {
		return ""
	}
	if region != "" {
		for _, n := range g.Noms {
			if n.Region == region && n.Text != "" {
				return n.Text
			}
		}
	}
	for _, n := range g.Noms {
		if n.Region == "ss" && n.Text != "" {
			return n.Text
		}
	}
	for _, n := range g.Noms {
		if n.Text != "" {
			return n.Text
		}
	}
	return ""
}

// NormalizedTitle strips the "ZZZ(notgame):" prefix added by ScreenScraper for
// non-game entries.
func (g *GameInfo) NormalizedTitle(region string) string {
	return strings.TrimPrefix(g.Title(region), "ZZZ(notgame):")
}

// Synopsis returns the game synopsis for a language (e.g. "es", "en"),
// falling back to any available synopsis.
func (g *GameInfo) GetSynopsis(lang string) string {
	if g == nil {
		return ""
	}
	if lang != "" {
		for _, s := range g.Synopsis {
			if s.Langue == lang && s.Text != "" {
				return s.Text
			}
		}
	}
	for _, s := range g.Synopsis {
		if s.Text != "" {
			return s.Text
		}
	}
	return ""
}

// ReleaseDate returns a date string (e.g. "1998-12-01") for the preferred
// region, falling back to any available date.
func (g *GameInfo) ReleaseDate(region string) string {
	if g == nil {
		return ""
	}
	if region != "" {
		for _, d := range g.Dates {
			if d.Region == region && d.Text != "" {
				return d.Text
			}
		}
	}
	for _, d := range g.Dates {
		if d.Text != "" {
			return d.Text
		}
	}
	return ""
}

// PlayerCount returns the number of players parsed from the "joueurs" text
// (e.g. "1", "1-2", "2-4"), or 0 when unknown.
func (g *GameInfo) PlayerCount() int {
	if g == nil || g.Joueurs == nil {
		return 0
	}
	text := g.Joueurs.Text
	if text == "" {
		return 0
	}
	if n, err := strconv.Atoi(text); err == nil {
		return n
	}
	// "1-2" or "2-4" -> take the max player count.
	parts := strings.Split(text, "-")
	max := 0
	for _, p := range parts {
		if n, err := strconv.Atoi(strings.TrimSpace(p)); err == nil && n > max {
			max = n
		}
	}
	return max
}

// Note returns the game score parsed from the "note" text (0-20), or 0.
func (g *GameInfo) NoteScore() int {
	if g == nil || g.Note == nil {
		return 0
	}
	n, _ := strconv.Atoi(g.Note.Text)
	return n
}

// coverTypes is the priority order for physical box/support covers.
var coverOrder = []string{
	"box-3D",
	"box-2D",
	"box-texture",
	"support-2D",
	"support-texture",
}

// CoverURL picks the best physical cover (case/box art) for a preferred
// region, falling back to fanart.
func (g *GameInfo) CoverURL(region string) string {
	if g == nil {
		return ""
	}
	region = normalizeRegion(region)
	for _, t := range coverOrder {
		if u := pickMedia(g.Medias, t, region); u != "" {
			return u
		}
	}
	// Last resort: any fanart.
	for _, m := range g.Medias {
		if m.Type == "fanart" && m.URL != "" {
			return m.URL
		}
	}
	return ""
}

// AllCovers returns every cover URL grouped by key/type.
func (g *GameInfo) AllCovers() map[string]string {
	out := map[string]string{}
	if g == nil {
		return out
	}
	for _, m := range g.Medias {
		t := m.Type
		if !strings.HasPrefix(t, "box") && !strings.HasPrefix(t, "support") {
			continue
		}
		key := t
		if m.Region != "" {
			key = t + "_" + m.Region
		}
		if _, exists := out[key]; !exists {
			out[key] = m.URL
		}
	}
	return out
}

// Token returns the media token understood by ScreenScraper's mediaJeu.php,
// e.g. "box-2D(eu)" or simply "fanart". It carries no credentials and is
// safe to expose through the media proxy URL.
func (m *MediaItem) Token() string {
	if m == nil {
		return ""
	}
	if m.Region != "" {
		return m.Type + "(" + m.Region + ")"
	}
	return m.Type
}

// PrimaryMediaItem returns the best physical cover (case/box art) MediaItem
// for a preferred region, mirroring CoverURL. Falls back to fanart.
func (g *GameInfo) PrimaryMediaItem(region string) *MediaItem {
	if g == nil {
		return nil
	}
	region = normalizeRegion(region)
	if region != "" {
		for _, t := range coverOrder {
			for i := range g.Medias {
				if g.Medias[i].Type == t && g.Medias[i].Region == region && g.Medias[i].URL != "" {
					return &g.Medias[i]
				}
			}
		}
	}
	for _, t := range coverOrder {
		for i := range g.Medias {
			if g.Medias[i].Type == t && g.Medias[i].URL != "" {
				return &g.Medias[i]
			}
		}
	}
	for i := range g.Medias {
		if g.Medias[i].Type == "fanart" && g.Medias[i].URL != "" {
			return &g.Medias[i]
		}
	}
	return nil
}

// isImageMedia reports whether a media item is an image worth persisting and
// exposing (excludes videos and manuals).
func isImageMedia(m *MediaItem) bool {
	if m == nil || m.Type == "" || m.URL == "" {
		return false
	}
	t := strings.ToLower(m.Type)
	return !strings.Contains(t, "video") && !strings.Contains(t, "manuel")
}

// pickMedia returns the first URL of a given media type, preferring the
// requested region.
func pickMedia(items []MediaItem, wantType, region string) string {
	if region != "" {
		for _, m := range items {
			if m.Type == wantType && m.Region == region && m.URL != "" {
				return m.URL
			}
		}
	}
	for _, m := range items {
		if m.Type == wantType && m.URL != "" {
			return m.URL
		}
	}
	return ""
}

// IsNotGame reports whether ScreenScraper flagged this as a non-game entry.
func (g *GameInfo) IsNotGame() bool {
	return g != nil && (g.NotGame == "true" || g.NotGame == "1")
}

// OfficialContent reports whether the game passes the official-content filter,
// returning the reason when it does not (see architecture #16). It relies on
// the ROM flags present in jeuInfos.php; when no ROM data is available the
// game is considered official (the jeuRecherche endpoint omits ROMs).
func (g *GameInfo) OfficialContent() (bool, string) {
	if g == nil {
		return false, "no game data"
	}
	if g.IsNotGame() {
		return false, "not a game (demo/application)"
	}
	if len(g.Roms) == 0 {
		return true, ""
	}
	rom := g.Roms[0]
	switch {
	case flag(rom.Hack):
		return false, "hack"
	case flag(rom.UNL):
		return false, "unofficial"
	case flag(rom.Demo):
		return false, "demo"
	case flag(rom.Beta):
		return false, "beta"
	case flag(rom.Proto):
		return false, "prototype"
	case flag(rom.Trad):
		return false, "translation patch"
	case flag(rom.Alt):
		return false, "alternative"
	}
	return true, ""
}

// flag parses a ScreenScraper "0"/"1" string flag into a bool.
func flag(s string) bool {
	return s == "1"
}

func normalizeRegion(r string) string {
	switch r {
	case "eu", "us", "jp", "fr", "es", "wor", "ss", "":
		return r
	default:
		return ""
	}
}
