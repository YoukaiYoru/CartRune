package games

import (
	"errors"
	"strconv"

	"github.com/YoukaiYoru/api/pkg/response"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) ListGames(c fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	result, err := h.service.List(page, limit)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to list games")
	}

	return response.Success(c, result)
}

func (h *Handler) GetGame(c fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid game id")
	}

	game, err := h.service.GetGameDetail(id)
	if err != nil {
		if err.Error() == "game not found" {
			return response.Error(c, fiber.StatusNotFound, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to get game")
	}

	return response.Success(c, game)
}

func (h *Handler) SearchGames(c fiber.Ctx) error {
	query := c.Query("q")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	result, err := h.service.Search(query, page, limit)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to search games")
	}

	return response.Success(c, result)
}

func (h *Handler) GetReleases(c fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid game id")
	}

	releases, err := h.service.GetReleases(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.Error(c, fiber.StatusNotFound, "game not found")
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to get releases")
	}

	return response.Success(c, releases)
}

func (h *Handler) GetCovers(c fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid game id")
	}

	covers, err := h.service.GetCovers(id)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to get covers")
	}

	return response.Success(c, covers)
}
