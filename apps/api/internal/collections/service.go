package collections

import (
	"errors"
	"time"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/YoukaiYoru/api/internal/social"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Service struct {
	repo *Repository
	rec  social.ActivityRecorder
}

func NewService(repo *Repository, recorder social.ActivityRecorder) *Service {
	return &Service{repo: repo, rec: recorder}
}

func (s *Service) GetUserLibraries(userID uuid.UUID) ([]models.Library, error) {
	return s.repo.FindByUserID(userID)
}

func (s *Service) CreateLibrary(userID uuid.UUID, req CreateLibraryRequest) (*models.Library, error) {
	lib := &models.Library{
		ID:          uuid.New(),
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		IsPublic:    req.IsPublic,
	}

	if err := s.repo.Create(lib); err != nil {
		return nil, err
	}
	return lib, nil
}

func (s *Service) GetLibrary(id uuid.UUID) (*models.Library, error) {
	lib, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("library not found")
		}
		return nil, err
	}
	return lib, nil
}

func (s *Service) UpdateLibrary(id uuid.UUID, userID uuid.UUID, req UpdateLibraryRequest) (*models.Library, error) {
	lib, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}

	if lib.UserID != userID {
		return nil, errors.New("unauthorized")
	}

	if req.Name != "" {
		lib.Name = req.Name
	}
	if req.Description != "" {
		lib.Description = req.Description
	}
	if req.IsPublic != nil {
		lib.IsPublic = *req.IsPublic
	}

	if err := s.repo.Update(lib); err != nil {
		return nil, err
	}
	return lib, nil
}

func (s *Service) DeleteLibrary(id uuid.UUID, userID uuid.UUID) error {
	lib, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}

	if lib.UserID != userID {
		return errors.New("unauthorized")
	}

	return s.repo.Delete(id)
}

func (s *Service) AddGame(libraryID, userID uuid.UUID, req AddGameRequest) error {
	lib, err := s.repo.FindByID(libraryID)
	if err != nil {
		return err
	}

	if lib.UserID != userID {
		return errors.New("unauthorized")
	}

	gameID, err := uuid.Parse(req.GameID)
	if err != nil {
		return errors.New("invalid game id")
	}

	lg := &models.LibraryGame{
		LibraryID: libraryID,
		GameID:    gameID,
		Status:    "backlog",
		AddedAt:   time.Now(),
	}

	if req.ReleaseID != "" {
		releaseID, err := uuid.Parse(req.ReleaseID)
		if err == nil {
			lg.ReleaseID = &releaseID
		}
	}

	if req.Status != "" {
		lg.Status = req.Status
	}

	if err := s.repo.AddGame(lg); err != nil {
		return err
	}

	if s.rec != nil {
		_ = s.rec(userID, "added", gameID)
	}
	return nil
}

func (s *Service) RemoveGame(libraryID, userID uuid.UUID, gameID uuid.UUID) error {
	lib, err := s.repo.FindByID(libraryID)
	if err != nil {
		return err
	}

	if lib.UserID != userID {
		return errors.New("unauthorized")
	}

	return s.repo.RemoveGame(libraryID, gameID)
}
