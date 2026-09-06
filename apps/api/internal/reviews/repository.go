package reviews

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

func (r *Repository) FindByID(id uuid.UUID) (*models.Review, error) {
	var review models.Review
	err := r.db.Preload("User").First(&review, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &review, nil
}

func (r *Repository) FindByGameID(gameID uuid.UUID, offset, limit int) ([]models.Review, int64, error) {
	var reviews []models.Review
	var total int64

	q := r.db.Model(&models.Review{}).Where("game_id = ?", gameID)
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := q.
		Preload("User").
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&reviews).Error

	return reviews, total, err
}

func (r *Repository) Create(review *models.Review) error {
	return r.db.Create(review).Error
}

func (r *Repository) Update(review *models.Review) error {
	return r.db.Save(review).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Review{}, "id = ?", id).Error
}

func (r *Repository) Like(reviewID, userID uuid.UUID) error {
	like := models.ReviewLike{
		ReviewID:  reviewID,
		UserID:    userID,
		CreatedAt: time.Now(),
	}
	return r.db.Create(&like).Error
}

func (r *Repository) Unlike(reviewID, userID uuid.UUID) error {
	return r.db.Delete(&models.ReviewLike{}, "review_id = ? AND user_id = ?", reviewID, userID).Error
}

func (r *Repository) HasLiked(reviewID, userID uuid.UUID) bool {
	var count int64
	r.db.Model(&models.ReviewLike{}).Where("review_id = ? AND user_id = ?", reviewID, userID).Count(&count)
	return count > 0
}

func (r *Repository) GetLikesCount(reviewID uuid.UUID) int64 {
	var count int64
	r.db.Model(&models.ReviewLike{}).Where("review_id = ?", reviewID).Count(&count)
	return count
}

func (r *Repository) CreateComment(comment *models.Comment) error {
	return r.db.Create(comment).Error
}

func (r *Repository) GetComments(reviewID uuid.UUID, offset, limit int) ([]models.Comment, error) {
	var comments []models.Comment
	err := r.db.
		Preload("User").
		Where("review_id = ?", reviewID).
		Offset(offset).
		Limit(limit).
		Order("created_at ASC").
		Find(&comments).Error
	return comments, err
}
