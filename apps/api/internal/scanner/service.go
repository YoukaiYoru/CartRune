package scanner

import (
	"context"
	"strings"
	"time"

	"github.com/YoukaiYoru/api/internal/games"
	"github.com/YoukaiYoru/api/internal/media"
	"github.com/YoukaiYoru/api/internal/models"
	"github.com/google/uuid"
)

type Service struct {
	gameRepo *games.Repository
	fallback CatalogFallback
}

type CatalogFallback interface {
	ImportByQuery(context.Context, string, string) (string, error)
}

func NewService(gameRepo *games.Repository, fallback CatalogFallback) *Service {
	return &Service{gameRepo: gameRepo, fallback: fallback}
}

func coverURLFor(g models.Game) string {
	if c := media.PrimaryCover(g.Covers); c != nil {
		return media.CoverPath(c.ID)
	}
	return ""
}

func (s *Service) ScanText(ctx context.Context, text, platformHint string) (*ScanResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	text = strings.TrimSpace(text)
	gamesList, err := s.gameRepo.FindByText(ctx, text, platformHint)
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

	matches := make([]MatchResult, 0)
	for _, g := range gamesList {
		for _, release := range g.Releases {
			matches = append(matches, MatchResult{
				GameID: g.ID.String(), ReleaseID: release.ID.String(), Title: g.Title,
				Platform: release.Platform.Name, Region: release.Region, CoverURL: coverURLFor(g),
			})
		}
	}
	result := &ScanResponse{Matches: matches, Method: "text", MatchSource: "catalog"}
	if usedFallback {
		result.Fallback = "screenscraper"
	}
	return result, nil
}
