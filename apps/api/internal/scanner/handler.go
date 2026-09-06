package scanner

import (
	"github.com/YoukaiYoru/api/pkg/response"
	"github.com/gofiber/fiber/v3"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Barcode(c fiber.Ctx) error {
	var req BarcodeRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Barcode == "" {
		return response.Error(c, fiber.StatusBadRequest, "barcode is required")
	}

	scan, err := h.service.ScanBarcode(req.Barcode)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to scan barcode")
	}

	return response.Success(c, scan)
}

func (h *Handler) Text(c fiber.Ctx) error {
	var req TextRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Text == "" {
		return response.Error(c, fiber.StatusBadRequest, "text is required")
	}

	scan, err := h.service.ScanText(req.Text, req.PlatformHint)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to scan text")
	}

	return response.Success(c, scan)
}

func (h *Handler) Match(c fiber.Ctx) error {
	var req MatchRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if len(req.Embedding) == 0 {
		return response.Error(c, fiber.StatusBadRequest, "embedding is required")
	}

	scan, err := h.service.MatchEmbedding(req.Embedding, req.PlatformHint)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to match embedding")
	}

	return response.Success(c, scan)
}
