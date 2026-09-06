package games

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

func (r *Repository) FindByID(id uuid.UUID) (*models.Game, error) {
	var game models.Game
	err := r.db.
		Preload("Platforms").
		Preload("Releases").
		Preload("Releases.Platform").
		Preload("Covers").
		First(&game, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &game, nil
}

func (r *Repository) FindBySlug(slug string) (*models.Game, error) {
	var game models.Game
	err := r.db.
		Preload("Platforms").
		Preload("Releases").
		Preload("Releases.Platform").
		Preload("Covers").
		First(&game, "slug = ?", slug).Error
	if err != nil {
		return nil, err
	}
	return &game, nil
}

func (r *Repository) Search(query string, offset, limit int) ([]models.Game, int64, error) {
	var games []models.Game
	var total int64

	q := r.db.Model(&models.Game{})
	if query != "" {
		q = q.Where("title ILIKE ?", "%"+query+"%")
	}

	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := q.
		Offset(offset).
		Limit(limit).
		Order("title ASC").
		Find(&games).Error

	return games, total, err
}

func (r *Repository) List(offset, limit int) ([]models.Game, int64, error) {
	var games []models.Game
	var total int64

	if err := r.db.Model(&models.Game{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&games).Error

	return games, total, err
}

func (r *Repository) GetReleases(gameID uuid.UUID) ([]models.Release, error) {
	var releases []models.Release
	err := r.db.
		Preload("Platform").
		Where("game_id = ?", gameID).
		Find(&releases).Error
	return releases, err
}

func (r *Repository) GetCovers(gameID uuid.UUID) ([]models.Cover, error) {
	var covers []models.Cover
	err := r.db.Where("game_id = ?", gameID).Find(&covers).Error
	return covers, err
}

func (r *Repository) GetStats(gameID uuid.UUID) (avgRating float64, reviewsCount int64, err error) {
	err = r.db.Model(&models.Review{}).
		Where("game_id = ?", gameID).
		Select("COALESCE(AVG(rating), 0)").
		Scan(&avgRating).Error
	if err != nil {
		return
	}
	err = r.db.Model(&models.Review{}).
		Where("game_id = ?", gameID).
		Count(&reviewsCount).Error
	return
}

func (r *Repository) GetPrimaryCovers(gameIDs []uuid.UUID) (map[uuid.UUID]models.Cover, error) {
	byGame := make(map[uuid.UUID]models.Cover)
	if len(gameIDs) == 0 {
		return byGame, nil
	}

	var covers []models.Cover
	err := r.db.
		Where("game_id IN ? AND primary = true", gameIDs).
		Find(&covers).Error
	if err != nil {
		return nil, err
	}

	// Fall back to the first cover per game if no primary flag is set.
	seen := make(map[uuid.UUID]bool)
	for _, cv := range covers {
		if !seen[cv.GameID] {
			byGame[cv.GameID] = cv
			seen[cv.GameID] = true
		}
	}

	if len(byGame) < len(gameIDs) {
		var remainder []uuid.UUID
		for _, id := range gameIDs {
			if !seen[id] {
				remainder = append(remainder, id)
			}
		}
		var fallback []models.Cover
		err = r.db.
			Where("game_id IN ?", remainder).
			Order("created_at ASC").
			Find(&fallback).Error
		if err != nil {
			return nil, err
		}
		for _, cv := range fallback {
			if _, ok := byGame[cv.GameID]; !ok {
				byGame[cv.GameID] = cv
			}
		}
	}

	return byGame, nil
}

func (r *Repository) FindByBarcode(barcode string) ([]models.Game, error) {
	// Search in releases or a future barcode field
	var games []models.Game
	err := r.db.
		Joins("JOIN releases ON releases.game_id = games.id").
		Where("releases.barcode = ?", barcode).
		Preload("Platforms").
		Preload("Releases").
		Preload("Covers").
		Distinct().
		Find(&games).Error
	return games, err
}

func (r *Repository) FindByText(query string) ([]models.Game, error) {
	var games []models.Game
	err := r.db.
		Where("title ILIKE ?", "%"+query+"%").
		Preload("Platforms").
		Preload("Releases").
		Preload("Covers").
		Limit(10).
		Find(&games).Error
	return games, err
}
