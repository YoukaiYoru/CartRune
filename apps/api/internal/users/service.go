package users

import (
	"errors"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetPublicProfile(username string) (*PublicProfileResponse, error) {
	user, err := s.repo.FindByUsername(username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	gamesCount, completedCount, hoursPlayed, avgRating, err := s.repo.GetUserStats(user.ID)
	if err != nil {
		return nil, err
	}

	return &PublicProfileResponse{
		ID:             user.ID.String(),
		Username:       user.Username,
		AvatarURL:      user.AvatarURL,
		Bio:            user.Bio,
		GamesCount:     int(gamesCount),
		CompletedCount: int(completedCount),
		HoursPlayed:    hoursPlayed,
		AvgRating:      avgRating,
	}, nil
}

func (s *Service) UpdateProfile(userID uuid.UUID, req UpdateProfileRequest) (*models.User, error) {
	user, err := s.repo.FindByID(userID)
	if err != nil {
		return nil, err
	}

	if req.Username != "" {
		user.Username = req.Username
	}
	if req.AvatarURL != "" {
		user.AvatarURL = req.AvatarURL
	}
	if req.Bio != "" {
		user.Bio = req.Bio
	}

	if err := s.repo.Update(user); err != nil {
		return nil, err
	}
	return user, nil
}
