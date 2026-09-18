package auth

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

func (h *Handler) Register(c fiber.Ctx) error {
	var req RegisterRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Username == "" || req.Email == "" || req.Password == "" {
		return response.Error(c, fiber.StatusBadRequest, "username, email and password are required")
	}

	tokens, err := h.service.Register(req)
	if err != nil {
		if err.Error() == "email already registered" || err.Error() == "username already taken" {
			return response.Error(c, fiber.StatusConflict, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to register")
	}

	return response.Created(c, tokens)
}

func (h *Handler) Login(c fiber.Ctx) error {
	var req LoginRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Email == "" || req.Password == "" {
		return response.Error(c, fiber.StatusBadRequest, "email and password are required")
	}

	tokens, err := h.service.Login(req)
	if err != nil {
		if err.Error() == "invalid credentials" {
			return response.Error(c, fiber.StatusUnauthorized, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to login")
	}

	return response.Success(c, tokens)
}

func (h *Handler) Refresh(c fiber.Ctx) error {
	var req RefreshRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.RefreshToken == "" {
		return response.Error(c, fiber.StatusBadRequest, "refresh_token is required")
	}

	tokens, err := h.service.Refresh(req.RefreshToken)
	if err != nil {
		return response.Error(c, fiber.StatusUnauthorized, "invalid refresh token")
	}

	return response.Success(c, tokens)
}

func (h *Handler) Logout(c fiber.Ctx) error {
	var req RefreshRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}
	if err := h.service.Logout(req.RefreshToken); err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to logout")
	}
	return response.NoContent(c)
}

func (h *Handler) Me(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	user, err := h.service.GetCurrentUser(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.Error(c, fiber.StatusNotFound, "user not found")
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to get user")
	}

	return response.Success(c, UserResponse{
		ID:        user.ID.String(),
		Username:  user.Username,
		Email:     user.Email,
		AvatarURL: user.AvatarURL,
		Bio:       user.Bio,
	})
}
