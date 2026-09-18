package screenscraper

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestClientSendsProviderContractAndRetriesTransientFailures(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		q := r.URL.Query()
		for key, want := range map[string]string{
			"devid":       "dev-id",
			"devpassword": "dev-secret",
			"softname":    "CartRune",
			"output":      "json",
			"recherche":   "Sonic",
		} {
			if q.Get(key) != want {
				t.Errorf("query %s = %q, want %q", key, q.Get(key), want)
			}
		}
		if calls.Load() == 1 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"header":{"error":""},"response":{"jeux":[]}}`))
	}))
	defer server.Close()

	client := New(Options{
		BaseURL:     server.URL,
		DevID:       "dev-id",
		DevPassword: "dev-secret",
		SoftName:    "CartRune",
		MinDelay:    0,
		MaxRetry:    1,
		Timeout:     time.Second,
	})

	if _, err := client.SearchByName(context.Background(), "Sonic", 0); err != nil {
		t.Fatalf("SearchByName returned error: %v", err)
	}
	if got := calls.Load(); got != 2 {
		t.Fatalf("upstream calls = %d, want 2", got)
	}
}

func TestClientMapsProviderAuthenticationFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer server.Close()

	client := New(Options{BaseURL: server.URL, DevID: "dev", DevPassword: "pass", MinDelay: 0})
	_, err := client.SearchByName(context.Background(), "Sonic", 0)
	if err != ErrProviderAuth {
		t.Fatalf("error = %v, want ErrProviderAuth", err)
	}
}

func TestServiceCachesSearchesWithinTTL(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"header":{"error":""},"response":{"jeux":[{"id":"123","noms":[{"region":"ss","text":"Sonic"}],"systeme":{"id":"1","text":"Mega Drive"}}]}}`))
	}))
	defer server.Close()

	service := NewServiceWithOptions(
		New(Options{BaseURL: server.URL, DevID: "dev", DevPassword: "pass", MinDelay: 0}),
		nil,
		ServiceOptions{CacheTTL: time.Minute},
	)
	request := SearchRequest{Query: " Sonic "}
	first, err := service.Search(context.Background(), request)
	if err != nil || len(first) != 1 {
		t.Fatalf("first search = %#v, error = %v", first, err)
	}
	second, err := service.Search(context.Background(), request)
	if err != nil || len(second) != 1 {
		t.Fatalf("second search = %#v, error = %v", second, err)
	}
	if got := calls.Load(); got != 1 {
		t.Fatalf("upstream calls = %d, want 1 due to cache", got)
	}
}

func TestClientThrottleHonorsContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"header":{"error":""},"response":{"jeux":[]}}`))
	}))
	defer server.Close()

	client := New(Options{BaseURL: server.URL, DevID: "dev", DevPassword: "pass", MinDelay: time.Hour})
	if _, err := client.SearchByName(context.Background(), "One", 0); err != nil {
		t.Fatalf("first request returned error: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	_, err := client.SearchByName(ctx, "Two", 0)
	if err == nil || !strings.Contains(err.Error(), context.DeadlineExceeded.Error()) {
		t.Fatalf("error = %v, want context deadline exceeded", err)
	}
}

func TestClassifyProviderError(t *testing.T) {
	checks := map[string]error{
		"invalid devpassword": ErrProviderAuth,
		"quota exceeded":      ErrRateLimited,
		"game not found":      ErrNotFound,
	}
	for message, want := range checks {
		if got := classifyProviderError(message); got != want {
			t.Errorf("classifyProviderError(%q) = %v, want %v", message, got, want)
		}
	}

	// Keep this test honest if the response shape changes: the client must still
	// be able to decode the normalized fixture envelope.
	var envelope APIResponse
	if err := json.Unmarshal([]byte(`{"header":{"error":""},"response":{"jeux":[]}}`), &envelope); err != nil {
		t.Fatal(err)
	}
}
