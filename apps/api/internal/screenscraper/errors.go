package screenscraper

import "errors"

var (
	// ErrNoCredentials indicates developer credentials are not configured.
	ErrNoCredentials = errors.New("ScreenScraper credentials not configured (SS_DEVID / SS_DEVPASSWORD)")

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
