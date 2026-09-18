package scanner

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/YoukaiYoru/api/internal/observability"
	"github.com/YoukaiYoru/api/internal/vector"
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/YoukaiYoru/api/pkg/response"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
	metrics *observability.Recorder
}

func NewHandler(service *Service, metrics *observability.Recorder) *Handler {
	return &Handler{service: service, metrics: metrics}
}

func (h *Handler) Barcode(c fiber.Ctx) error {
	var req BarcodeRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if strings.TrimSpace(req.Barcode) == "" {
		return response.Error(c, fiber.StatusBadRequest, "barcode is required")
	}

	started := time.Now()
	scan, err := h.service.ScanBarcode(c.Context(), req.Barcode)
	h.record(c.Context(), middleware.GetUserID(c), "barcode", scan, err, started)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to scan barcode")
	}
	log.Printf("[scanner] barcode matched matches=%d", len(scan.Matches))

	return response.Success(c, scan)
}

func (h *Handler) Text(c fiber.Ctx) error {
	var req TextRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if strings.TrimSpace(req.Text) == "" {
		return response.Error(c, fiber.StatusBadRequest, "text is required")
	}

	started := time.Now()
	scan, err := h.service.ScanText(c.Context(), req.Text, req.PlatformHint)
	h.record(c.Context(), middleware.GetUserID(c), "text", scan, err, started)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to scan text")
	}
	log.Printf("[scanner] text matched platform=%s matches=%d", strings.TrimSpace(req.PlatformHint), len(scan.Matches))

	return response.Success(c, scan)
}

func (h *Handler) Stats(c fiber.Ctx) error {
	stats, err := h.service.Stats(c.Context())
	if err != nil {
		return response.Error(c, fiber.StatusServiceUnavailable, "vector store unavailable")
	}
	return response.Success(c, stats)
}

func (h *Handler) Match(c fiber.Ctx) error {
	var req MatchRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if len(req.Embedding) == 0 {
		return response.Error(c, fiber.StatusBadRequest, "embedding is required")
	}
	if len(req.Embedding) != vector.DefaultDims {
		return response.Error(c, fiber.StatusBadRequest, "invalid embedding dimension")
	}

	started := time.Now()
	scan, err := h.service.MatchEmbedding(req.Embedding, req.PlatformHint)
	h.record(c.Context(), middleware.GetUserID(c), "embedding", scan, err, started)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to match embedding")
	}
	log.Printf("[scanner] visual cover matched platform=%s matches=%d", strings.TrimSpace(req.PlatformHint), len(scan.Matches))

	return response.Success(c, scan)
}

func (h *Handler) record(ctx context.Context, userID uuid.UUID, method string, scan *ScanResponse, err error, started time.Time) {
	if h.metrics == nil {
		return
	}
	outcome := "success"
	errorCode := ""
	var confidence *float64
	if err != nil {
		outcome = "error"
		errorCode = "scanner_error"
	}
	if scan != nil && len(scan.Matches) == 0 && err == nil {
		outcome = "no_match"
	}
	if scan != nil && len(scan.Matches) > 0 {
		value := scan.Matches[0].Similarity
		if value > 0 {
			confidence = &value
		}
	}
	fallback := ""
	if scan != nil {
		fallback = scan.Fallback
	}
	h.metrics.RecordScan(ctx, userID, method, outcome, fallback, confidence, time.Since(started), errorCode)
}
