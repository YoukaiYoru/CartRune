package users

import (
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

func (r *Repository) FindByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.First(&user, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) FindByUsername(username string) (*models.User, error) {
	var user models.User
	err := r.db.Where("username = ?", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

func (r *Repository) GetUserStats(userID uuid.UUID) (gamesCount int64, completedCount int64, hoursPlayed float64, avgRating float64, err error) {
	err = r.db.Model(&models.LibraryGame{}).
		Joins("JOIN libraries ON libraries.id = library_games.library_id").
		Where("libraries.user_id = ?", userID).
		Count(&gamesCount).Error
	if err != nil {
		return
	}

	err = r.db.Model(&models.LibraryGame{}).
		Joins("JOIN libraries ON libraries.id = library_games.library_id").
		Where("libraries.user_id = ? AND library_games.status = ?", userID, "completed").
		Count(&completedCount).Error
	if err != nil {
		return
	}

	err = r.db.Model(&models.LibraryGame{}).
		Joins("JOIN libraries ON libraries.id = library_games.library_id").
		Where("libraries.user_id = ?", userID).
		Select("COALESCE(SUM(library_games.hours_played), 0)").
		Scan(&hoursPlayed).Error
	if err != nil {
		return
	}

	err = r.db.Model(&models.Review{}).
		Where("user_id = ?", userID).
		Select("COALESCE(AVG(rating), 0)").
		Scan(&avgRating).Error
	return
}
