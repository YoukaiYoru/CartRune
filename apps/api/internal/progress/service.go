package progress

import (
	"errors"
	"time"

	"github.com/YoukaiYoru/api/internal/collections"
	"github.com/google/uuid"
)

type Service struct {
	collectionService *collections.Service
	collectionRepo    *collections.Repository
}

func NewService(collectionService *collections.Service, collectionRepo *collections.Repository) *Service {
	return &Service{
		collectionService: collectionService,
		collectionRepo:    collectionRepo,
	}
}

func (s *Service) UpdateProgress(userID, gameID uuid.UUID, req UpdateProgressRequest) (*ProgressResponse, error) {
	// Find the library game entry
	libs, err := s.collectionRepo.FindByUserID(userID)
	if err != nil {
		return nil, err
	}

	for _, lib := range libs {
		lg, err := s.collectionRepo.FindGameInLibrary(lib.ID, gameID)
		if err == nil {
			if req.Status != "" {
				lg.Status = req.Status
			}
			if req.Progress != nil {
				lg.Progress = *req.Progress
			}
			if req.HoursPlayed != nil {
				lg.HoursPlayed = *req.HoursPlayed
			}
			if req.StartedAt != nil {
				if t, err := time.Parse(time.RFC3339, *req.StartedAt); err == nil {
					lg.StartedAt = &t
				}
			}
			if req.CompletedAt != nil {
				if t, err := time.Parse(time.RFC3339, *req.CompletedAt); err == nil {
					lg.CompletedAt = &t
				}
			}

			if err := s.collectionRepo.UpdateGameInLibrary(lg); err != nil {
				return nil, err
			}

			var startedAt, completedAt *string
			if lg.StartedAt != nil {
				s := lg.StartedAt.Format("2006-01-02T15:04:05Z")
				startedAt = &s
			}
			if lg.CompletedAt != nil {
				s := lg.CompletedAt.Format("2006-01-02T15:04:05Z")
				completedAt = &s
			}

			return &ProgressResponse{
				GameID:      gameID.String(),
				Status:      lg.Status,
				Progress:    lg.Progress,
				HoursPlayed: lg.HoursPlayed,
				StartedAt:   startedAt,
				CompletedAt: completedAt,
			}, nil
		}
	}

	return nil, errors.New("game not found in any library")
}

func (s *Service) StartGame(userID, gameID uuid.UUID) (*ProgressResponse, error) {
	now := time.Now().Format(time.RFC3339)
	return s.UpdateProgress(userID, gameID, UpdateProgressRequest{
		Status:    "playing",
		StartedAt: &now,
	})
}

func (s *Service) CompleteGame(userID, gameID uuid.UUID) (*ProgressResponse, error) {
	now := time.Now().Format(time.RFC3339)
	progress := 100
	return s.UpdateProgress(userID, gameID, UpdateProgressRequest{
		Status:      "completed",
		Progress:    &progress,
		CompletedAt: &now,
	})
}
