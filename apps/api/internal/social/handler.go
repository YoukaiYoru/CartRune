package social

import (
	"strconv"

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

func (h *Handler) Follow(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	targetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid user id")
	}

	err = h.service.Follow(userID, targetID)
	if err != nil {
		if err.Error() == "cannot follow yourself" {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		if err.Error() == "already following" {
			return response.Error(c, fiber.StatusConflict, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to follow user")
	}

	return response.Created(c, fiber.Map{"message": "user followed"})
}

func (h *Handler) Unfollow(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	targetID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid user id")
	}

	err = h.service.Unfollow(userID, targetID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to unfollow user")
	}

	return response.NoContent(c)
}

func (h *Handler) GetFeed(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	items, err := h.service.GetFeed(userID, page, limit)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to get feed")
	}

	return response.Success(c, items)
}
