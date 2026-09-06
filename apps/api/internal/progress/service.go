package progress

import (
	"errors"
	"time"

	"github.com/YoukaiYoru/api/internal/collections"
	"github.com/YoukaiYoru/api/internal/social"
	"github.com/google/uuid"
)

type Service struct {
	collectionService *collections.Service
	collectionRepo    *collections.Repository
	rec               social.ActivityRecorder
}

func NewService(
	collectionService *collections.Service,
	collectionRepo *collections.Repository,
	recorder social.ActivityRecorder,
) *Service {
	return &Service{
		collectionService: collectionService,
		collectionRepo:    collectionRepo,
		rec:               recorder,
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
	resp, err := s.UpdateProgress(userID, gameID, UpdateProgressRequest{
		Status:    "playing",
		StartedAt: &now,
	})
	if err != nil {
		return nil, err
	}
	if s.rec != nil {
		_ = s.rec(userID, "playing", gameID)
	}
	return resp, nil
}

func (s *Service) CompleteGame(userID, gameID uuid.UUID) (*ProgressResponse, error) {
	now := time.Now().Format(time.RFC3339)
	progress := 100
	resp, err := s.UpdateProgress(userID, gameID, UpdateProgressRequest{
		Status:      "completed",
		Progress:    &progress,
		CompletedAt: &now,
	})
	if err != nil {
		return nil, err
	}
	if s.rec != nil {
		_ = s.rec(userID, "completed", gameID)
	}
	return resp, nil
}
