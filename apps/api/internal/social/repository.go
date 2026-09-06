package social

import (
	"time"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Follow(followerID, followingID uuid.UUID) error {
	follow := models.Follow{
		FollowerID:  followerID,
		FollowingID: followingID,
		CreatedAt:   time.Now(),
	}
	return r.db.Create(&follow).Error
}

func (r *Repository) Unfollow(followerID, followingID uuid.UUID) error {
	return r.db.Delete(&models.Follow{}, "follower_id = ? AND following_id = ?", followerID, followingID).Error
}

func (r *Repository) IsFollowing(followerID, followingID uuid.UUID) bool {
	var count int64
	r.db.Model(&models.Follow{}).Where("follower_id = ? AND following_id = ?", followerID, followingID).Count(&count)
	return count > 0
}

func (r *Repository) GetFollowers(userID uuid.UUID) ([]models.Follow, error) {
	var follows []models.Follow
	err := r.db.Preload("Follower").Where("following_id = ?", userID).Order("created_at DESC").Find(&follows).Error
	return follows, err
}

func (r *Repository) GetFollowing(userID uuid.UUID) ([]models.Follow, error) {
	var follows []models.Follow
	err := r.db.Preload("Following").Where("follower_id = ?", userID).Order("created_at DESC").Find(&follows).Error
	return follows, err
}

func (r *Repository) GetFeed(userID uuid.UUID, offset, limit int) ([]models.Activity, error) {
	var activities []models.Activity

	// Get activities from followed users + own activities
	err := r.db.
		Preload("User").
		Joins("JOIN follows ON follows.following_id = activities.user_id").
		Where("follows.follower_id = ?", userID).
		Or("activities.user_id = ?", userID).
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&activities).Error

	return activities, err
}

func (r *Repository) CreateActivity(activity *models.Activity) error {
	return r.db.Create(activity).Error
}
