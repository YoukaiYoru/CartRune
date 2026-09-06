package reviews

import (
	"errors"
	"strconv"

	"github.com/YoukaiYoru/api/pkg/middleware"
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

func (h *Handler) GetGameReviews(c fiber.Ctx) error {
	gameID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid game id")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	reviews, total, err := h.service.GetGameReviews(gameID, page, limit)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to get reviews")
	}

	return response.Success(c, fiber.Map{
		"reviews": reviews,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

func (h *Handler) CreateReview(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req CreateReviewRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.GameID == "" || req.Rating == 0 {
		return response.Error(c, fiber.StatusBadRequest, "game_id and rating are required")
	}

	review, err := h.service.CreateReview(userID, req)
	if err != nil {
		if err.Error() == "rating must be between 1 and 5" {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to create review")
	}

	return response.Created(c, review)
}

func (h *Handler) UpdateReview(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	reviewID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid review id")
	}

	var req UpdateReviewRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	review, err := h.service.UpdateReview(reviewID, userID, req)
	if err != nil {
		if err.Error() == "unauthorized" {
			return response.Error(c, fiber.StatusForbidden, err.Error())
		}
		if err.Error() == "review not found" {
			return response.Error(c, fiber.StatusNotFound, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to update review")
	}

	return response.Success(c, review)
}

func (h *Handler) DeleteReview(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	reviewID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid review id")
	}

	err = h.service.DeleteReview(reviewID, userID)
	if err != nil {
		if err.Error() == "unauthorized" {
			return response.Error(c, fiber.StatusForbidden, err.Error())
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.Error(c, fiber.StatusNotFound, "review not found")
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to delete review")
	}

	return response.NoContent(c)
}

func (h *Handler) LikeReview(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	reviewID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid review id")
	}

	err = h.service.LikeReview(reviewID, userID)
	if err != nil {
		if err.Error() == "review not found" {
			return response.Error(c, fiber.StatusNotFound, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to like review")
	}

	return response.Created(c, fiber.Map{"message": "review liked"})
}

func (h *Handler) UnlikeReview(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	reviewID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid review id")
	}

	err = h.service.UnlikeReview(reviewID, userID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to unlike review")
	}

	return response.NoContent(c)
}

func (h *Handler) AddComment(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	reviewID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid review id")
	}

	var req CommentRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Content == "" {
		return response.Error(c, fiber.StatusBadRequest, "content is required")
	}

	comment, err := h.service.AddComment(reviewID, userID, req.Content)
	if err != nil {
		if err.Error() == "review not found" {
			return response.Error(c, fiber.StatusNotFound, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to add comment")
	}

	return response.Created(c, comment)
}

func (h *Handler) GetComments(c fiber.Ctx) error {
	reviewID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid review id")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	comments, err := h.service.GetComments(reviewID, page, limit)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to get comments")
	}

	return response.Success(c, comments)
}
