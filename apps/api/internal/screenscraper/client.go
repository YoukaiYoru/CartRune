package screenscraper

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
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
}

type Options struct {
	BaseURL      string
	DevID        string
	DevPassword  string
	SoftName     string
	UserID       string
	UserPassword string
	MinDelay     time.Duration // min time between requests to respect threads/quota
	MaxRetry     int
}

func New(opts Options) *Client {
	base := opts.BaseURL
	if base == "" {
		base = "https://api.screenscraper.fr/api2/"
	}
	if opts.MinDelay == 0 {
		opts.MinDelay = 1500 * time.Millisecond
	}
	if opts.MaxRetry == 0 {
		opts.MaxRetry = 2
	}
	return &Client{
		baseURL:    strings.TrimRight(base, "/") + "/",
		httpClient: &http.Client{Timeout: 20 * time.Second},
		devID:      opts.DevID,
		devPass:    opts.DevPassword,
		softName:   opts.SoftName,
		ssID:       opts.UserID,
		ssPass:     opts.UserPassword,
		minDelay:   opts.MinDelay,
		maxRetry:   opts.MaxRetry,
	}
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
	for attempt := 0; attempt <= c.maxRetry; attempt++ {
		if attempt > 0 {
			// respect satellite throttling before retrying
			select {
			case <-ctx.Done():
				return lastStatus, ctx.Err()
			case <-time.After(time.Duration(attempt) * time.Second):
			}
		}
		c.throttle()

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

		if resp.StatusCode == http.StatusTooManyRequests {
			lastErr = ErrRateLimited
			continue
		}
		if resp.StatusCode != http.StatusOK {
			snippet := strings.TrimSpace(string(body))
			if len(snippet) > 200 {
				snippet = snippet[:200]
			}
			return resp.StatusCode, fmt.Errorf("%w: %d %s", ErrUnexpectedStatus, resp.StatusCode, snippet)
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
func (c *Client) throttle() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.minDelay > 0 {
		if since := time.Since(c.lastReq); since < c.minDelay {
			time.Sleep(c.minDelay - since)
		}
		c.lastReq = time.Now()
	}
}
