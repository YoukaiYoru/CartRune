package gemini

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	apiKey string
	model  string
	http   *http.Client
}

type Analysis struct {
	Title     string `json:"title"`
	Console   string `json:"console"`
	Region    string `json:"region"`
	Edition   string `json:"edition"`
	Publisher string `json:"publisher"`
	Query     string `json:"query"`
}

func New(apiKey, model string, timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = 45 * time.Second
	}
	return &Client{
		apiKey: strings.TrimSpace(apiKey),
		model:  model,
		http:   &http.Client{Timeout: timeout},
	}
}

func (c *Client) Configured() bool { return c != nil && c.apiKey != "" }

func (c *Client) AnalyzeCover(ctx context.Context, image []byte, mimeType string) (Analysis, error) {
	if !c.Configured() {
		return Analysis{}, fmt.Errorf("Gemini API is not configured")
	}
	if !strings.HasPrefix(mimeType, "image/") {
		mimeType = "image/jpeg"
	}

	payload := map[string]any{
		"contents": []any{map[string]any{"parts": []any{
			map[string]any{"inlineData": map[string]string{
				"mimeType": mimeType,
				"data":     base64.StdEncoding.EncodeToString(image),
			}},
			map[string]string{"text": "Identify this physical video game cover. Return only JSON. Extract title, console, region, edition, publisher, and a concise search query. Use empty strings when unknown."},
		}}},
		"generationConfig": map[string]any{
			"responseMimeType": "application/json",
			"responseSchema": map[string]any{
				"type": "OBJECT",
				"properties": map[string]any{
					"title":     map[string]string{"type": "STRING"},
					"console":   map[string]string{"type": "STRING"},
					"region":    map[string]string{"type": "STRING"},
					"edition":   map[string]string{"type": "STRING"},
					"publisher": map[string]string{"type": "STRING"},
					"query":     map[string]string{"type": "STRING"},
				},
				"required": []string{"title", "console", "region", "edition", "publisher", "query"},
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return Analysis{}, fmt.Errorf("encode Gemini request: %w", err)
	}
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent", c.model)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return Analysis{}, fmt.Errorf("create Gemini request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", c.apiKey)
	resp, err := c.http.Do(req)
	if err != nil {
		return Analysis{}, fmt.Errorf("Gemini request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return Analysis{}, fmt.Errorf("Gemini returned HTTP %d", resp.StatusCode)
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return Analysis{}, fmt.Errorf("decode Gemini response: %w", err)
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return Analysis{}, fmt.Errorf("Gemini returned no analysis")
	}
	var analysis Analysis
	if err := json.Unmarshal([]byte(result.Candidates[0].Content.Parts[0].Text), &analysis); err != nil {
		return Analysis{}, fmt.Errorf("decode Gemini analysis: %w", err)
	}
	if strings.TrimSpace(analysis.Query) == "" {
		analysis.Query = strings.TrimSpace(strings.Join([]string{analysis.Title, analysis.Console}, " "))
	}
	return analysis, nil
}
