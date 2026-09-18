package embeddings

import (
	"bytes"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/YoukaiYoru/api/internal/observability"
	"github.com/gofiber/fiber/v3"
)

// Proxy keeps the private ML service address out of the mobile app. The
// request body is forwarded untouched so multipart boundaries remain valid.
type Proxy struct {
	baseURL    string
	client     *http.Client
	slowClient *http.Client
	metrics    *observability.Recorder
}

func NewProxy(baseURL string, metrics *observability.Recorder) *Proxy {
	return &Proxy{
		baseURL:    strings.TrimRight(baseURL, "/"),
		client:     &http.Client{Timeout: 120 * time.Second},
		slowClient: &http.Client{Timeout: 180 * time.Second},
		metrics:    metrics,
	}
}

func (p *Proxy) Embed(c fiber.Ctx) error { return p.forward(c, "/embed") }

func (p *Proxy) OCR(c fiber.Ctx) error { return p.forward(c, "/ocr") }

func (p *Proxy) AnalyzeCover(c fiber.Ctx) error { return p.forward(c, "/analyze-cover") }

func (p *Proxy) forward(c fiber.Ctx, path string) error {
	started := time.Now()
	status := 0
	defer func() {
		if p.metrics != nil {
			p.metrics.RecordDependency(c.Context(), "embeddings", strings.TrimPrefix(path, "/"), status >= 200 && status < 300, status, time.Since(started), "")
		}
	}()
	log.Printf("[scanner] cover analysis started operation=%s bytes=%d", strings.TrimPrefix(path, "/"), len(c.Body()))
	req, err := http.NewRequestWithContext(c.Context(), http.MethodPost, p.baseURL+path, bytes.NewReader(c.Body()))
	if err != nil {
		return fiber.NewError(fiber.StatusServiceUnavailable, "embedding service unavailable")
	}
	req.Header.Set("Content-Type", string(c.Request().Header.ContentType()))

	client := p.client
	if path == "/analyze-cover" {
		client = p.slowClient
	}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[scanner] cover analysis failed operation=%s duration_ms=%d error=%v", strings.TrimPrefix(path, "/"), time.Since(started).Milliseconds(), err)
		return fiber.NewError(fiber.StatusServiceUnavailable, "embedding service unavailable")
	}
	status = resp.StatusCode
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		log.Printf("[scanner] cover analysis failed operation=%s duration_ms=%d error=read_response", strings.TrimPrefix(path, "/"), time.Since(started).Milliseconds())
		return fiber.NewError(fiber.StatusServiceUnavailable, "embedding service unavailable")
	}
	log.Printf("[scanner] cover analysis finished operation=%s status=%d duration_ms=%d", strings.TrimPrefix(path, "/"), resp.StatusCode, time.Since(started).Milliseconds())
	if contentType := resp.Header.Get("Content-Type"); contentType != "" {
		c.Set(fiber.HeaderContentType, contentType)
	}
	return c.Status(resp.StatusCode).Send(body)
}
