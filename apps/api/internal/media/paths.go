package media

import (
	"net/url"
	"strconv"
	"strings"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/google/uuid"
)

const (
	// CoverPathPrefix is the API path served by the persisted-coverage proxy
	// (GET /api/v1/media/covers/:id).
	CoverPathPrefix = "/api/v1/media/covers/"

	// GameMediaPathPrefix is the API path served by the on-the-fly proxy for a
	// ScreenScraper game media (GET /api/v1/media/games/:systemeid/:jeuid).
	GameMediaPathPrefix = "/api/v1/media/games/"
)

// CoverPath returns the proxy URL of a persisted cover. The underlying
// ScreenScraper source URL (with credentials) never leaves the backend.
func CoverPath(id uuid.UUID) string {
	return CoverPathPrefix + id.String()
}

// GameMediaPath returns the proxy URL of a ScreenScraper media token (e.g.
// "box-2D(eu)" or "box-3D(us)") for a remote game. Clients pass identifiers
// (system/game/media), never ScreenScraper credentials.
func GameMediaPath(systemeID, gameID int, key string) string {
	return GameMediaPathPrefix +
		strconv.Itoa(systemeID) + "/" + strconv.Itoa(gameID) +
		"?media=" + url.QueryEscape(key)
}

// SanitizeSSURL strips the credential query parameters (devid, devpassword,
// ssid, sspassword) plus the JSON "output" hint from a ScreenScraper media URL
// so credentials are never persisted or returned. The remaining parameters
// (systemeid, jeuid, media, ...) are non-sensitive and keep the URL usable for
// the proxy, which re-attaches the credentials server-side at fetch time.
func SanitizeSSURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	q := u.Query()
	for _, k := range []string{"devid", "devpassword", "ssid", "sspassword", "output"} {
		q.Del(k)
	}
	q.Del("softname") // reconstructed by the proxy
	u.RawQuery = q.Encode()
	return u.String()
}

// PrimaryCover picks the default cover of a game for list views: the cover
// flagged as primary, falling back to a box/support cover then any cover.
func PrimaryCover(covers []models.Cover) *models.Cover {
	for i := range covers {
		if covers[i].Primary {
			return &covers[i]
		}
	}
	for i := range covers {
		if strings.HasPrefix(covers[i].Type, "box") || strings.HasPrefix(covers[i].Type, "support") {
			return &covers[i]
		}
	}
	if len(covers) > 0 {
		return &covers[0]
	}
	return nil
}
