package screenscraper

import (
	"errors"
	"strconv"

	"github.com/YoukaiYoru/api/pkg/response"
	"github.com/gofiber/fiber/v3"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Search handles POST /screenscraper/search.
func (h *Handler) Search(c fiber.Ctx) error {
	var req SearchRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}
	if req.Query == "" {
		return response.Error(c, fiber.StatusBadRequest, "query is required")
	}

	items, err := h.service.Search(c.Context(), req)
	if err != nil {
		return mapScraperError(c, err)
	}
	return response.Success(c, items)
}

// Detail handles GET /screenscraper/games/:id.
func (h *Handler) Detail(c fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid game id")
	}

	detail, err := h.service.Detail(c.Context(), id, c.Query("region"), c.Query("language"))
	if err != nil {
		return mapScraperError(c, err)
	}
	return response.Success(c, detail)
}

// Import handles POST /screenscraper/games/:id/import.
func (h *Handler) Import(c fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid game id")
	}

	res, err := h.service.Import(c.Context(), id, c.Query("region"), c.Query("language"))
	if err != nil {
		if errors.Is(err, ErrFiltered) {
			return response.ErrorWithDetails(c, fiber.StatusUnprocessableEntity, err.Error(), "game rejected by official-content filter")
		}
		return mapScraperError(c, err)
	}
	return response.Success(c, res)
}

func mapScraperError(c fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, ErrNoCredentials):
		return response.ErrorWithDetails(c, fiber.StatusServiceUnavailable, err.Error(),
			"set SS_DEVID / SS_DEVPASSWORD (and optionally SS_USERID / SS_USERPASSWORD) on the API")
	case errors.Is(err, ErrNotFound):
		return response.Error(c, fiber.StatusNotFound, "no game found")
	case errors.Is(err, ErrRateLimited):
		return response.Error(c, fiber.StatusTooManyRequests, "ScreenScraper rate limit reached, retry later")
	default:
		return response.Error(c, fiber.StatusBadGateway, "ScreenScraper request failed")
	}
}
