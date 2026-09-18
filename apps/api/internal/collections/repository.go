package collections

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

func (r *Repository) FindByID(id uuid.UUID) (*models.Library, error) {
	var lib models.Library
	err := r.db.
		Preload("Games").
		Preload("Games.Game").
		Preload("Games.Game.Covers").
		Preload("Games.Release").
		Preload("Games.Release.Platform").
		First(&lib, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &lib, nil
}

func (r *Repository) FindPublicByID(id uuid.UUID) (*models.Library, error) {
	var lib models.Library
	err := r.db.
		Preload("Games").
		Preload("Games.Game").
		Preload("Games.Game.Covers").
		Preload("Games.Release").
		Preload("Games.Release.Platform").
		Where("id = ? AND is_public = true", id).
		First(&lib).Error
	return &lib, err
}

func (r *Repository) FindByUserID(userID uuid.UUID) ([]models.Library, error) {
	var libs []models.Library
	err := r.db.Preload("Games").Where("user_id = ?", userID).Order("created_at DESC").Find(&libs).Error
	return libs, err
}

func (r *Repository) Create(lib *models.Library) error {
	return r.db.Create(lib).Error
}

func (r *Repository) Update(lib *models.Library) error {
	return r.db.Save(lib).Error
}

func (r *Repository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Library{}, "id = ?", id).Error
}

func (r *Repository) AddGame(lg *models.LibraryGame) error {
	return r.db.Create(lg).Error
}

func (r *Repository) FindGame(id uuid.UUID) (*models.Game, error) {
	var game models.Game
	err := r.db.First(&game, "id = ?", id).Error
	return &game, err
}

func (r *Repository) FindReleaseForGame(releaseID, gameID uuid.UUID) (*models.Release, error) {
	var release models.Release
	err := r.db.Preload("Platform").Where("id = ? AND game_id = ?", releaseID, gameID).First(&release).Error
	return &release, err
}

func (r *Repository) RemoveGame(libraryID, gameID uuid.UUID) error {
	return r.db.Delete(&models.LibraryGame{}, "library_id = ? AND game_id = ?", libraryID, gameID).Error
}

func (r *Repository) FindGameInLibrary(libraryID, gameID uuid.UUID) (*models.LibraryGame, error) {
	var lg models.LibraryGame
	err := r.db.Where("library_id = ? AND game_id = ?", libraryID, gameID).First(&lg).Error
	if err != nil {
		return nil, err
	}
	return &lg, nil
}

func (r *Repository) UpdateGameInLibrary(lg *models.LibraryGame) error {
	return r.db.Save(lg).Error
}
