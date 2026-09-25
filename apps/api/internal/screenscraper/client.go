package screenscraper

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/YoukaiYoru/api/internal/observability"
)

// Client is a thin adapter around the ScreenScraper WebAPI v2.
// It talks to the endpoints documented at
// https://www.screenscraper.fr/webapi2.php (see docs/screenscraper-api.md):
//   - jeuRecherche.php : search a game by name (>= gameinfo, without roms)
//   - jeuInfos.php     : full game info + media (covers) by game id
type Client struct {
	baseURL    string
	httpClient *http.Client
	devID      string
	devPass    string
	softName   string
	ssID       string
	ssPass     string

	mu       sync.Mutex
	lastReq  time.Time
	minDelay time.Duration
	maxRetry int
	metrics  *observability.Recorder
}

type Options struct {
	BaseURL      string
	DevID        string
	DevPassword  string
	SoftName     string
	UserID       string
	UserPassword string
	Timeout      time.Duration
	MinDelay     time.Duration // min time between requests to respect threads/quota
	MaxRetry     int
	Metrics      *observability.Recorder
}

func New(opts Options) *Client {
	base := normalizeBaseURL(opts.BaseURL)
	if opts.SoftName == "" {
		opts.SoftName = "CartRune"
	}
	if opts.MinDelay < 0 {
		opts.MinDelay = 0
	}
	if opts.MinDelay == 0 && opts.BaseURL == "" {
		opts.MinDelay = 1500 * time.Millisecond
	}
	if opts.MaxRetry < 0 {
		opts.MaxRetry = 0
	}
	if opts.MaxRetry == 0 {
		opts.MaxRetry = 2
	}
	if opts.Timeout <= 0 {
		opts.Timeout = 20 * time.Second
	}
	return &Client{
		baseURL:    strings.TrimRight(base, "/") + "/",
		httpClient: &http.Client{Timeout: opts.Timeout},
		devID:      opts.DevID,
		devPass:    opts.DevPassword,
		softName:   opts.SoftName,
		ssID:       opts.UserID,
		ssPass:     opts.UserPassword,
		minDelay:   opts.MinDelay,
		maxRetry:   opts.MaxRetry,
		metrics:    opts.Metrics,
	}
}

func normalizeBaseURL(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return "https://api.screenscraper.fr/api2/"
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "https://api.screenscraper.fr/api2/"
	}
	return raw
}

// CredentialsConfigured reports whether developer credentials are present.
func (c *Client) CredentialsConfigured() bool {
	return c.devID != "" && c.devPass != ""
}

// baseQuery returns the common query parameters shared by all endpoints.
func (c *Client) baseQuery() url.Values {
	q := url.Values{}
	q.Set("devid", c.devID)
	q.Set("devpassword", c.devPass)
	q.Set("softname", c.softName)
	q.Set("output", "json")
	if c.ssID != "" {
		q.Set("ssid", c.ssID)
		q.Set("sspassword", c.ssPass)
	}
	return q
}

// get performs a GET request with throttling and retries, decoding into out.
func (c *Client) get(ctx context.Context, endpoint string, q url.Values, out interface{}) (int, error) {
	if !c.CredentialsConfigured() {
		return 0, ErrNoCredentials
	}

	u := c.baseURL + endpoint + "?" + q.Encode()

	var lastStatus int
	var lastErr error
	started := time.Now()
	log.Printf("[catalog] request started operation=%s", endpoint)
	defer func() {
		log.Printf("[catalog] request finished operation=%s status=%d duration_ms=%d", endpoint, lastStatus, time.Since(started).Milliseconds())
		if c.metrics != nil {
			c.metrics.RecordDependency(ctx, "screenscraper", endpoint, lastStatus >= 200 && lastStatus < 300, lastStatus, time.Since(started), "")
		}
	}()
	for attempt := 0; attempt <= c.maxRetry; attempt++ {
		if attempt > 0 {
			// respect satellite throttling before retrying
			select {
			case <-ctx.Done():
				return lastStatus, ctx.Err()
			case <-time.After(time.Duration(attempt) * time.Second):
			}
		}
		if err := c.throttle(ctx); err != nil {
			return lastStatus, err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err != nil {
			return 0, err
		}
		req.Header.Set("User-Agent", "CartRune/0.1")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		lastStatus = resp.StatusCode

		if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
			return resp.StatusCode, ErrProviderAuth
		}
		if resp.StatusCode == http.StatusTooManyRequests {
			lastErr = ErrRateLimited
			continue
		}
		if resp.StatusCode == http.StatusNotFound {
			return resp.StatusCode, ErrNotFound
		}
		if resp.StatusCode != http.StatusOK {
			snippet := strings.TrimSpace(string(body))
			if len(snippet) > 200 {
				snippet = snippet[:200]
			}
			errType := ErrUnexpectedStatus
			if shouldRetryStatus(resp.StatusCode) {
				errType = ErrProviderDown
				lastErr = fmt.Errorf("%w: %d %s", errType, resp.StatusCode, snippet)
				continue
			}
			return resp.StatusCode, fmt.Errorf("%w: %d %s", errType, resp.StatusCode, snippet)
		}

		if out != nil {
			if err := json.Unmarshal(body, out); err != nil {
				return resp.StatusCode, fmt.Errorf("%w: %v", ErrDecode, err)
			}
		}
		return resp.StatusCode, nil
	}
	if lastErr != nil {
		return lastStatus, lastErr
	}
	return 0, errors.New("request failed")
}

// throttle enforces the minimum delay between consecutive calls.
func (c *Client) throttle(ctx context.Context) error {
	for {
		c.mu.Lock()
		wait := c.minDelay - time.Since(c.lastReq)
		if wait <= 0 {
			c.lastReq = time.Now()
			c.mu.Unlock()
			return nil
		}
		c.mu.Unlock()

		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return ctx.Err()
		case <-timer.C:
		}
	}
}

func shouldRetryStatus(status int) bool {
	return status == http.StatusRequestTimeout || status == http.StatusTooManyRequests || status >= 500
}
