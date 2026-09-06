package collections

import (
	"errors"

	"github.com/YoukaiYoru/api/internal/media"
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

func (h *Handler) ListLibraries(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	libs, err := h.service.GetUserLibraries(userID)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to list libraries")
	}

	var result []LibraryResponse
	for _, lib := range libs {
		result = append(result, LibraryResponse{
			ID:          lib.ID.String(),
			UserID:      lib.UserID.String(),
			Name:        lib.Name,
			Description: lib.Description,
			IsPublic:    lib.IsPublic,
			GamesCount:  0, // Will be filled from relation
			CreatedAt:   lib.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	return response.Success(c, result)
}

func (h *Handler) CreateLibrary(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req CreateLibraryRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.Name == "" {
		return response.Error(c, fiber.StatusBadRequest, "name is required")
	}

	lib, err := h.service.CreateLibrary(userID, req)
	if err != nil {
		return response.Error(c, fiber.StatusInternalServerError, "failed to create library")
	}

	return response.Created(c, LibraryResponse{
		ID:          lib.ID.String(),
		UserID:      lib.UserID.String(),
		Name:        lib.Name,
		Description: lib.Description,
		IsPublic:    lib.IsPublic,
		CreatedAt:   lib.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *Handler) GetLibrary(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid library id")
	}

	lib, err := h.service.GetLibrary(id)
	if err != nil {
		if err.Error() == "library not found" {
			return response.Error(c, fiber.StatusNotFound, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to get library")
	}

	resp := LibraryDetailResponse{
		LibraryResponse: LibraryResponse{
			ID:          lib.ID.String(),
			UserID:      lib.UserID.String(),
			Name:        lib.Name,
			Description: lib.Description,
			IsPublic:    lib.IsPublic,
			GamesCount:  len(lib.Games),
			CreatedAt:   lib.CreatedAt.Format("2006-01-02T15:04:05Z"),
		},
	}

	for _, lg := range lib.Games {
		gameResp := LibraryGameResponse{
			GameID:      lg.GameID.String(),
			Status:      lg.Status,
			Progress:    lg.Progress,
			HoursPlayed: lg.HoursPlayed,
			AddedAt:     lg.AddedAt.Format("2006-01-02T15:04:05Z"),
		}
		if lg.ReleaseID != nil {
			s := lg.ReleaseID.String()
			gameResp.ReleaseID = &s
		}
		if lg.StartedAt != nil {
			s := lg.StartedAt.Format("2006-01-02T15:04:05Z")
			gameResp.StartedAt = &s
		}
		if lg.CompletedAt != nil {
			s := lg.CompletedAt.Format("2006-01-02T15:04:05Z")
			gameResp.CompletedAt = &s
		}
		if lg.Game.Title != "" {
			gameResp.Title = lg.Game.Title
		}
		if lg.Release != nil && lg.Release.Platform.Name != "" {
			gameResp.Platform = lg.Release.Platform.Name
		}
		if cv := media.PrimaryCover(lg.Game.Covers); cv != nil {
			gameResp.CoverURL = media.CoverPath(cv.ID)
		}
		resp.Games = append(resp.Games, gameResp)
	}

	return response.Success(c, resp)
}

func (h *Handler) UpdateLibrary(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid library id")
	}

	var req UpdateLibraryRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	lib, err := h.service.UpdateLibrary(id, userID, req)
	if err != nil {
		if err.Error() == "unauthorized" {
			return response.Error(c, fiber.StatusForbidden, err.Error())
		}
		if err.Error() == "library not found" {
			return response.Error(c, fiber.StatusNotFound, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to update library")
	}

	return response.Success(c, LibraryResponse{
		ID:          lib.ID.String(),
		UserID:      lib.UserID.String(),
		Name:        lib.Name,
		Description: lib.Description,
		IsPublic:    lib.IsPublic,
		CreatedAt:   lib.CreatedAt.Format("2006-01-02T15:04:05Z"),
	})
}

func (h *Handler) DeleteLibrary(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid library id")
	}

	err = h.service.DeleteLibrary(id, userID)
	if err != nil {
		if err.Error() == "unauthorized" {
			return response.Error(c, fiber.StatusForbidden, err.Error())
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return response.Error(c, fiber.StatusNotFound, "library not found")
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to delete library")
	}

	return response.NoContent(c)
}

func (h *Handler) AddGame(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	libraryID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid library id")
	}

	var req AddGameRequest
	if err := c.Bind().Body(&req); err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}

	if req.GameID == "" {
		return response.Error(c, fiber.StatusBadRequest, "game_id is required")
	}

	err = h.service.AddGame(libraryID, userID, req)
	if err != nil {
		if err.Error() == "unauthorized" {
			return response.Error(c, fiber.StatusForbidden, err.Error())
		}
		if err.Error() == "invalid game id" {
			return response.Error(c, fiber.StatusBadRequest, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to add game")
	}

	return response.Created(c, fiber.Map{"message": "game added to library"})
}

func (h *Handler) RemoveGame(c fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	libraryID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid library id")
	}

	gameID, err := uuid.Parse(c.Params("gameId"))
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, "invalid game id")
	}

	err = h.service.RemoveGame(libraryID, userID, gameID)
	if err != nil {
		if err.Error() == "unauthorized" {
			return response.Error(c, fiber.StatusForbidden, err.Error())
		}
		return response.Error(c, fiber.StatusInternalServerError, "failed to remove game")
	}

	return response.NoContent(c)
}
