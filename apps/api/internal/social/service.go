package social

import (
	"errors"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Follow(followerID, followingID uuid.UUID) error {
	if followerID == followingID {
		return errors.New("cannot follow yourself")
	}

	if s.repo.IsFollowing(followerID, followingID) {
		return errors.New("already following")
	}

	return s.repo.Follow(followerID, followingID)
}

func (s *Service) Unfollow(followerID, followingID uuid.UUID) error {
	return s.repo.Unfollow(followerID, followingID)
}

func (s *Service) GetFollowers(userID uuid.UUID) ([]models.Follow, error) {
	return s.repo.GetFollowers(userID)
}

func (s *Service) GetFollowing(userID uuid.UUID) ([]models.Follow, error) {
	return s.repo.GetFollowing(userID)
}

func (s *Service) GetFeed(userID uuid.UUID, page, limit int) ([]FeedItem, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 20
	}
	offset := (page - 1) * limit

	activities, err := s.repo.GetFeed(userID, offset, limit)
	if err != nil {
		return nil, err
	}

	var items []FeedItem
	for _, a := range activities {
		item := FeedItem{
			ID:        a.ID.String(),
			UserID:    a.UserID.String(),
			Type:      a.Type,
			EntityID:  a.EntityID.String(),
			CreatedAt: a.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}
		if a.User.Username != "" {
			item.Username = a.User.Username
			item.AvatarURL = a.User.AvatarURL
		}
		items = append(items, item)
	}

	if len(items) > 0 {
		entities := make([]uuid.UUID, 0, len(items))
		for _, a := range activities {
			entities = append(entities, a.EntityID)
		}
		titles, err := s.repo.ResolveTitles(entities)
		if err == nil {
			for i, a := range activities {
				if title, ok := titles[a.EntityID]; ok {
					items[i].Title = title
				}
			}
		}
	}

	return items, nil
}

func (s *Service) RecordActivity(userID uuid.UUID, activityType string, entityID uuid.UUID) error {
	activity := &models.Activity{
		ID:       uuid.New(),
		UserID:   userID,
		Type:     activityType,
		EntityID: entityID,
	}
	return s.repo.CreateActivity(activity)
}
