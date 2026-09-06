package scanner

import (
	"context"
	"errors"

	"github.com/YoukaiYoru/api/internal/games"
	"github.com/YoukaiYoru/api/internal/media"
	"github.com/YoukaiYoru/api/internal/models"
	"github.com/YoukaiYoru/api/internal/vector"
)

type Service struct {
	gameRepo  *games.Repository
	vectorSvc *vector.Service
}

func NewService(gameRepo *games.Repository, vectorSvc *vector.Service) *Service {
	return &Service{gameRepo: gameRepo, vectorSvc: vectorSvc}
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

// scoreThreshold filters out weak cosine similarities so false positives from
// unrelated covers are not surfaced to the user.
var scoreThreshold float32 = 0.30

func (s *Service) MatchEmbedding(embedding []float64, platformHint string) (*ScanResponse, error) {
	if s.vectorSvc == nil {
		return nil, errors.New("vector store unavailable")
	}

	vec := make([]float32, len(embedding))
	for i, v := range embedding {
		vec[i] = float32(v)
	}

	matches, err := s.vectorSvc.Search(context.Background(), vec, 10, scoreThreshold)
	if err != nil {
		if errors.Is(err, vector.ErrUnavailable) {
			return nil, errors.New("vector store unavailable")
		}
		return nil, err
	}

	results := make([]MatchResult, 0, len(matches))
	for _, m := range matches {
		results = append(results, MatchResult{
			GameID:     m.GameID,
			ReleaseID:  m.ReleaseID,
			Title:      m.Title,
			Platform:   m.Platform,
			Region:     m.Region,
			CoverURL:   m.CoverURL,
			Similarity: m.Similarity,
		})
	}

	return &ScanResponse{
		Matches: results,
		Method:  "embedding",
	}, nil
}

// Stats delegates to the vector store for index metrics.
func (s *Service) Stats(ctx context.Context) (vector.Stats, error) {
	if s.vectorSvc == nil {
		return vector.Stats{}, errors.New("vector store unavailable")
	}
	return s.vectorSvc.Stats(ctx)
}

// GetGame returns a game for internal use
func (s *Service) GetGame(id string) (*models.Game, error) {
	// Not used directly, but available for future needs
	return nil, nil
}
