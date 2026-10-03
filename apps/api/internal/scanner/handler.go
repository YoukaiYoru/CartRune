package scanner

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/YoukaiYoru/api/internal/gemini"
	"github.com/YoukaiYoru/api/internal/observability"
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/YoukaiYoru/api/pkg/response"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
	gemini  *gemini.Client
	metrics *observability.Recorder
}

func NewHandler(service *Service, geminiClient *gemini.Client, metrics *observability.Recorder) *Handler {
	return &Handler{service: service, gemini: geminiClient, metrics: metrics}
}

func (h *Handler) Text(c fiber.Ctx) error {
	var req TextRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}
	if strings.TrimSpace(req.Text) == "" || len([]rune(req.Text)) > 120 {
		return response.Error(c, fiber.StatusBadRequest, "text is required")
	}
	if len([]rune(req.PlatformHint)) > 64 {
		return response.Error(c, fiber.StatusBadRequest, "platform hint is too long")
	}
	started := time.Now()
	scan, err := h.service.ScanText(c.Context(), req.Text, req.PlatformHint)
	h.record(c.Context(), middleware.GetUserID(c), "text", scan, err, started)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to scan text")
	}
	return response.Success(c, scan)
}

func (h *Handler) AnalyzeCover(c fiber.Ctx) error {
	if h.gemini == nil || !h.gemini.Configured() {
		return response.Error(c, fiber.StatusServiceUnavailable, "Gemini is not configured")
	}
	file, err := c.FormFile("image")
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "image is required")
	}
	if file.Size > 6*1024*1024 {
		return response.Error(c, fiber.StatusRequestEntityTooLarge, "image is too large")
	}
	opened, err := file.Open()
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "unable to read image")
	}
	defer opened.Close()
	data := make([]byte, file.Size)
	if _, err := opened.Read(data); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "unable to read image")
	}
	ctx, cancel := context.WithTimeout(c.Context(), 45*time.Second)
	defer cancel()
	analysis, err := h.gemini.AnalyzeCover(ctx, data, file.Header.Get("Content-Type"))
	if err != nil {
		log.Printf("WARN: Gemini cover analysis failed: %v", err)
		return response.Error(c, fiber.StatusBadGateway, "cover analysis unavailable")
	}
	return response.Success(c, CoverAnalysis{
		Title: analysis.Title, Console: analysis.Console, Region: analysis.Region,
		Edition: analysis.Edition, Publisher: analysis.Publisher, Query: analysis.Query,
	})
}

func (h *Handler) record(ctx context.Context, userID uuid.UUID, method string, scan *ScanResponse, err error, started time.Time) {
	if h.metrics == nil {
		return
	}
	outcome := "success"
	errorCode := ""
	if err != nil {
		outcome, errorCode = "error", "scanner_error"
	}
	if scan != nil && len(scan.Matches) == 0 && err == nil {
		outcome = "no_match"
	}
	fallback := ""
	if scan != nil {
		fallback = scan.Fallback
	}
	h.metrics.RecordScan(ctx, userID, method, outcome, fallback, nil, time.Since(started), errorCode)
}

func ScanLimit(max int) limiter.Config {
	return limiter.Config{
		Max: max, Expiration: time.Minute,
		KeyGenerator: func(c fiber.Ctx) string { return c.IP() },
		LimitReached: func(c fiber.Ctx) error { return fiber.NewError(fiber.StatusTooManyRequests, "too many scan requests") },
	}
}
