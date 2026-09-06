package games

import (
	"errors"

	"github.com/YoukaiYoru/api/internal/media"
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

func (s *Service) GetGame(id uuid.UUID) (*models.Game, error) {
	game, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("game not found")
		}
		return nil, err
	}
	return game, nil
}

func (s *Service) GetGameBySlug(slug string) (*models.Game, error) {
	game, err := s.repo.FindBySlug(slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("game not found")
		}
		return nil, err
	}
	return game, nil
}

func (s *Service) Search(query string, page, limit int) (*PaginatedGames, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	games, total, err := s.repo.Search(query, offset, limit)
	if err != nil {
		return nil, err
	}

	var responseGames []GameResponse
	for _, g := range games {
		responseGames = append(responseGames, gameToResponse(&g))
	}

	return &PaginatedGames{
		Games: responseGames,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

func (s *Service) List(page, limit int) (*PaginatedGames, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	games, total, err := s.repo.List(offset, limit)
	if err != nil {
		return nil, err
	}

	var responseGames []GameResponse
	for _, g := range games {
		responseGames = append(responseGames, gameToResponse(&g))
	}

	return &PaginatedGames{
		Games: responseGames,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

func (s *Service) GetReleases(gameID uuid.UUID) ([]ReleaseResponse, error) {
	releases, err := s.repo.GetReleases(gameID)
	if err != nil {
		return nil, err
	}

	var response []ReleaseResponse
	for _, r := range releases {
		resp := ReleaseResponse{
			ID:         r.ID.String(),
			GameID:     r.GameID.String(),
			PlatformID: r.PlatformID.String(),
			Region:     r.Region,
			Edition:    r.Edition,
			Physical:   r.Physical,
			Official:   r.Official,
		}
		if r.ReleaseDate != nil {
			resp.ReleaseDate = r.ReleaseDate.Format("2006-01-02")
		}
		if r.Platform.Name != "" {
			resp.PlatformName = r.Platform.Name
		}
		response = append(response, resp)
	}
	return response, nil
}

func (s *Service) GetCovers(gameID uuid.UUID) ([]CoverResponse, error) {
	covers, err := s.repo.GetCovers(gameID)
	if err != nil {
		return nil, err
	}

	var response []CoverResponse
	for _, cv := range covers {
		response = append(response, coverToResponse(&cv))
	}
	return response, nil
}

func (s *Service) GetGameDetail(id uuid.UUID) (*GameDetailResponse, error) {
	game, err := s.GetGame(id)
	if err != nil {
		return nil, err
	}

	avgRating, reviewsCount, _ := s.repo.GetStats(id)

	detail := &GameDetailResponse{
		GameResponse: gameToResponse(game),
		AvgRating:    avgRating,
		ReviewsCount: int(reviewsCount),
	}

	for _, p := range game.Platforms {
		detail.Platforms = append(detail.Platforms, PlatformResponse{
			ID:           p.ID.String(),
			Name:         p.Name,
			Slug:         p.Slug,
			Manufacturer: p.Manufacturer,
			Generation:   p.Generation,
		})
	}

	for _, r := range game.Releases {
		resp := ReleaseResponse{
			ID:         r.ID.String(),
			GameID:     r.GameID.String(),
			PlatformID: r.PlatformID.String(),
			Region:     r.Region,
			Edition:    r.Edition,
			Physical:   r.Physical,
			Official:   r.Official,
		}
		if r.ReleaseDate != nil {
			resp.ReleaseDate = r.ReleaseDate.Format("2006-01-02")
		}
		detail.Releases = append(detail.Releases, resp)
	}

	for _, cv := range game.Covers {
		detail.Covers = append(detail.Covers, coverToResponse(&cv))
	}

	return detail, nil
}

func gameToResponse(g *models.Game) GameResponse {
	resp := GameResponse{
		ID:          g.ID.String(),
		Title:       g.Title,
		Slug:        g.Slug,
		Description: g.Description,
		Developer:   g.Developer,
		Publisher:   g.Publisher,
	}
	if g.ReleaseDate != nil {
		resp.ReleaseDate = g.ReleaseDate.Format("2006-01-02")
	}
	return resp
}

// coverToResponse maps a persisted cover to its public representation. The
// URL points at the media proxy (JWT-protected); the raw ScreenScraper URL
// with credentials is never serialized.
func coverToResponse(cv *models.Cover) CoverResponse {
	return CoverResponse{
		ID:       cv.ID.String(),
		GameID:   cv.GameID.String(),
		URL:      media.CoverPath(cv.ID),
		Region:   cv.Region,
		Language: cv.Language,
		Type:     cv.Type,
		Width:    cv.Width,
		Height:   cv.Height,
		Source:   cv.Source,
		Primary:  cv.Primary,
	}
}
