package scanner

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/YoukaiYoru/api/internal/games"
	"github.com/YoukaiYoru/api/internal/media"
	"github.com/YoukaiYoru/api/internal/models"
	"github.com/YoukaiYoru/api/internal/vector"
	"github.com/google/uuid"
)

type Service struct {
	gameRepo  *games.Repository
	vectorSvc *vector.Service
	fallback  CatalogFallback
}

type CatalogFallback interface {
	ImportByQuery(context.Context, string, string) (string, error)
}

func NewService(gameRepo *games.Repository, vectorSvc *vector.Service, fallback CatalogFallback) *Service {
	return &Service{gameRepo: gameRepo, vectorSvc: vectorSvc, fallback: fallback}
}

func coverURLFor(g models.Game) string {
	if c := media.PrimaryCover(g.Covers); c != nil {
		return media.CoverPath(c.ID)
	}
	return ""
}

func (s *Service) ScanBarcode(ctx context.Context, barcode string) (*ScanResponse, error) {
	barcode = strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, barcode)
	gamesList, err := s.gameRepo.FindByBarcode(barcode)
	if err != nil {
		return nil, err
	}
	usedFallback := false
	if len(gamesList) == 0 && s.fallback != nil {
		if id, fallbackErr := s.fallback.ImportByQuery(ctx, barcode, ""); fallbackErr == nil {
			if gameID, parseErr := uuid.Parse(id); parseErr == nil {
				if game, findErr := s.gameRepo.FindByID(gameID); findErr == nil {
					gamesList = []models.Game{*game}
					usedFallback = true
				}
			}
		}
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

	result := &ScanResponse{Matches: matches, Method: "barcode"}
	if usedFallback {
		result.Fallback = "screenscraper"
	}
	return result, nil
}

func (s *Service) ScanText(ctx context.Context, text string, platformHint string) (*ScanResponse, error) {
	gamesList, err := s.gameRepo.FindByText(text, platformHint)
	if err != nil {
		return nil, err
	}
	usedFallback := false
	if len(gamesList) == 0 && s.fallback != nil {
		if id, fallbackErr := s.fallback.ImportByQuery(ctx, text, platformHint); fallbackErr == nil {
			if gameID, parseErr := uuid.Parse(id); parseErr == nil {
				if game, findErr := s.gameRepo.FindByID(gameID); findErr == nil {
					gamesList = []models.Game{*game}
					usedFallback = true
				}
			}
		}
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

	result := &ScanResponse{Matches: matches, Method: "text"}
	if usedFallback {
		result.Fallback = "screenscraper"
	}
	return result, nil
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

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// Fetch a wider candidate pool before applying platform hints. Filtering
	// only the first ten nearest covers can discard the correct release when a
	// different platform has a slightly higher visual score.
	matches, err := s.vectorSvc.Search(ctx, vec, 50, scoreThreshold)
	if err != nil {
		if errors.Is(err, vector.ErrUnavailable) {
			return nil, errors.New("vector store unavailable")
		}
		return nil, err
	}

	hint := strings.ToLower(strings.TrimSpace(platformHint))
	results := make([]MatchResult, 0, 3)
	for _, m := range matches {
		if hint != "" && !strings.Contains(strings.ToLower(m.Platform), hint) {
			continue
		}
		results = append(results, MatchResult{
			GameID:     m.GameID,
			ReleaseID:  m.ReleaseID,
			Title:      m.Title,
			Platform:   m.Platform,
			Region:     m.Region,
			CoverURL:   m.CoverURL,
			Similarity: m.Similarity,
		})
		if len(results) == 3 {
			break
		}
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
