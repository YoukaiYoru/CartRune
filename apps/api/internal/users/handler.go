package users

import (
	"errors"

	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/YoukaiYoru/api/pkg/response"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) GetProfile(c fiber.Ctx) error {
	username := c.Params("username")
	if username == "" {
		return response.Error(c, fiber.StatusBadRequest, "username is required")
	}

	profile, err := h.service.GetPublicProfile(username)
	if err != nil {
		if err.Error() == "user not found" {
			return response.Error(c, fiber.StatusNotFound, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to get profile")
	}

	return response.Success(c, profile)
}

func (h *Handler) UpdateProfile(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req UpdateProfileRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	user, err := h.service.UpdateProfile(userID, req)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.Error(c, fiber.StatusNotFound, "user not found")
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to update profile")
	}

	return response.Success(c, fiber.Map{
		"id":         user.ID,
		"username":   user.Username,
		"avatar_url": user.AvatarURL,
		"bio":        user.Bio,
	})
}
