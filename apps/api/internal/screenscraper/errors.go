package screenscraper

import (
	"errors"
	"fmt"
	"strings"
)

var (
	// ErrNoCredentials indicates developer credentials are not configured.
	ErrNoCredentials = errors.New("ScreenScraper credentials not configured (SS_DEVID / SS_DEVPASSWORD)")
	ErrProviderAuth  = errors.New("ScreenScraper authentication failed")
	ErrProviderDown  = errors.New("ScreenScraper unavailable")
	ErrInvalidQuery  = errors.New("invalid ScreenScraper query")

	// ErrRateLimited is returned when ScreenScraper answers with HTTP 429.
	ErrRateLimited = errors.New("ScreenScraper rate limit reached (429)")

	// ErrNotFound is returned when no game matches (HTTP 404).
	ErrNotFound = errors.New("no game found")

	// ErrUnexpectedStatus wraps an unexpected non-200 HTTP status.
	ErrUnexpectedStatus = errors.New("unexpected ScreenScraper response")

	// ErrDecode indicates the JSON payload could not be parsed.
	ErrDecode = errors.New("could not decode ScreenScraper response")
)

// ErrFiltered indicates a game was rejected by the official-content filter.
var ErrFiltered = errors.New("game filtered out")

func classifyProviderError(message string) error {
	text := strings.ToLower(strings.TrimSpace(message))
	switch {
	case strings.Contains(text, "password"), strings.Contains(text, "devid"), strings.Contains(text, "auth"), strings.Contains(text, "unauthor"):
		return ErrProviderAuth
	case strings.Contains(text, "quota"), strings.Contains(text, "limit"), strings.Contains(text, "too many"):
		return ErrRateLimited
	case strings.Contains(text, "not found"), strings.Contains(text, "no game"), strings.Contains(text, "unknown game"):
		return ErrNotFound
	default:
		return fmt.Errorf("%w: %s", ErrProviderDown, message)
	}
}
