package scanner

import (
	"github.com/YoukaiYoru/api/internal/games"
	"github.com/YoukaiYoru/api/internal/media"
	"github.com/YoukaiYoru/api/internal/models"
)

type Service struct {
	gameRepo *games.Repository
}

func NewService(gameRepo *games.Repository) *Service {
	return &Service{gameRepo: gameRepo}
}

func coverURLFor(g models.Game) string {
	if c := media.PrimaryCover(g.Covers); c != nil {
		return media.CoverPath(c.ID)
	}
	return ""
}

func (s *Service) ScanBarcode(barcode string) (*ScanResponse, error) {
	gamesList, err := s.gameRepo.FindByBarcode(barcode)
	if err != nil {
		return nil, err
	}

	var matches []MatchResult
	for _, g := range gamesList {
		for _, r := range g.Releases {
			platformName := ""
			if r.Platform.Name != "" {
				platformName = r.Platform.Name
			}
			matches = append(matches, MatchResult{
				GameID:    g.ID.String(),
				ReleaseID: r.ID.String(),
				Title:     g.Title,
				Platform:  platformName,
				Region:    r.Region,
				CoverURL:  coverURLFor(g),
			})
		}
	}

	return &ScanResponse{
		Matches: matches,
		Method:  "barcode",
	}, nil
}

func (s *Service) ScanText(text string, platformHint string) (*ScanResponse, error) {
	gamesList, err := s.gameRepo.FindByText(text)
	if err != nil {
		return nil, err
	}

	var matches []MatchResult
	for _, g := range gamesList {
		for _, r := range g.Releases {
			platformName := ""
			if r.Platform.Name != "" {
				platformName = r.Platform.Name
			}
			matches = append(matches, MatchResult{
				GameID:    g.ID.String(),
				ReleaseID: r.ID.String(),
				Title:     g.Title,
				Platform:  platformName,
				Region:    r.Region,
				CoverURL:  coverURLFor(g),
			})
		}
	}

	return &ScanResponse{
		Matches: matches,
		Method:  "text",
	}, nil
}

func (s *Service) MatchEmbedding(embedding []float64, platformHint string) (*ScanResponse, error) {
	// TODO: Integrate with Qdrant for vector similarity search
	// For now, return empty matches
	_ = embedding
	_ = platformHint

	return &ScanResponse{
		Matches: []MatchResult{},
		Method:  "embedding",
	}, nil
}

// GetGame returns a game for internal use
func (s *Service) GetGame(id string) (*models.Game, error) {
	// Not used directly, but available for future needs
	return nil, nil
}
