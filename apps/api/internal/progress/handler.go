package progress

import (
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/YoukaiYoru/api/pkg/response"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) UpdateProgress(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	gameID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid game id")
	}

	var req UpdateProgressRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	result, err := h.service.UpdateProgress(userID, gameID, req)
	if err != nil {
		if err.Error() == "game not found in any library" {
			return response.Error(c, fiber.StatusNotFound, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to update progress")
	}

	return response.Success(c, result)
}

func (h *Handler) StartGame(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	gameID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid game id")
	}

	result, err := h.service.StartGame(userID, gameID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to start game")
	}

	return response.Success(c, result)
}

func (h *Handler) CompleteGame(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	gameID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid game id")
	}

	result, err := h.service.CompleteGame(userID, gameID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to complete game")
	}

	return response.Success(c, result)
}
