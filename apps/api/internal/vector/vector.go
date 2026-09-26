// Package vector provides a thin wrapper around the Qdrant gRPC client used
// for visual game-cover matching (MobileCLIP embeddings).
package vector

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/YoukaiYoru/api/internal/observability"
	"github.com/qdrant/go-client/qdrant"
)

// DefaultDims is the embedding dimension produced by MobileCLIP-S0 (512).
const DefaultDims = 512

// CollectionName is the Qdrant collection holding game cover embeddings.
const CollectionName = "game_covers"

// Match is a scored Qdrant hit translated back into catalog terms.
type Match struct {
	GameID     string  `json:"game_id"`
	ReleaseID  string  `json:"release_id"`
	Title      string  `json:"title"`
	Platform   string  `json:"platform"`
	Region     string  `json:"region"`
	CoverURL   string  `json:"cover_url"`
	Similarity float64 `json:"similarity"`
}

// Point is one cover embedding to upsert into Qdrant.
type Point struct {
	ID        string
	Vector    []float32
	GameID    string
	ReleaseID string
	Title     string
	Platform  string
	Region    string
	CoverURL  string
}

// Service wraps the Qdrant client and the catalog-aware operations on top.
type Service struct {
	client  *qdrant.Client
	metrics *observability.Recorder
}

// Options configures the Qdrant connection.
type Options struct {
	Host    string
	Port    int
	APIKey  string
	UseTLS  bool
	Dims    int
	Metrics *observability.Recorder
}

// NewService builds the Service. The connection is lazy: the first real call
// performs the dial, so startup does not fail when Qdrant is down.
func NewService(opt Options) *Service {
	dims := opt.Dims
	if dims <= 0 {
		dims = DefaultDims
	}
	_ = dims // dims is applied when the collection is created

	client, err := qdrant.NewClient(&qdrant.Config{
		Host:   opt.Host,
		Port:   opt.Port,
		APIKey: opt.APIKey,
		UseTLS: opt.UseTLS,
	})
	if err != nil {
		// Client construction only prepares the pool; surface a descriptive
		// error at use time rather than crashing the server on boot.
		return &Service{client: nil, metrics: opt.Metrics}
	}
	return &Service{client: client, metrics: opt.Metrics}
}

// Healthy reports whether Qdrant is reachable.
func (s *Service) Healthy(ctx context.Context) bool {
	if s.client == nil {
		return false
	}
	_, err := s.client.HealthCheck(ctx)
	return err == nil
}

// EnsureCollection creates the collection (idempotent) with a cosine distance
// vector of the given dimension.
func (s *Service) EnsureCollection(ctx context.Context, dims int) error {
	if s.client == nil {
		return ErrUnavailable
	}
	if dims <= 0 {
		dims = DefaultDims
	}
	exists, err := s.client.CollectionExists(ctx, CollectionName)
	if err != nil {
		return fmt.Errorf("vector: check collection: %w", err)
	}
	if exists {
		return nil
	}
	err = s.client.CreateCollection(ctx, &qdrant.CreateCollection{
		CollectionName: CollectionName,
		VectorsConfig: qdrant.NewVectorsConfig(&qdrant.VectorParams{
			Size:     uint64(dims),
			Distance: qdrant.Distance_Cosine,
		}),
	})
	if err != nil {
		return fmt.Errorf("vector: create collection: %w", err)
	}
	log.Printf("vector: created Qdrant collection %q (dim=%d)", CollectionName, dims)
	return nil
}

// Upsert writes or updates cover embeddings for a set of points.
func (s *Service) Upsert(ctx context.Context, points []Point) error {
	if s.client == nil {
		return ErrUnavailable
	}
	pts := make([]*qdrant.PointStruct, 0, len(points))
	for _, p := range points {
		pts = append(pts, &qdrant.PointStruct{
			Id:      qdrant.NewID(p.ID),
			Vectors: qdrant.NewVectorsDense(p.Vector),
			Payload: qdrant.NewValueMap(map[string]any{
				"game_id":    p.GameID,
				"release_id": p.ReleaseID,
				"title":      p.Title,
				"platform":   p.Platform,
				"region":     p.Region,
				"cover_url":  p.CoverURL,
			}),
		})
	}
	_, err := s.client.Upsert(ctx, &qdrant.UpsertPoints{
		CollectionName: CollectionName,
		Points:         pts,
		Wait:           boolPtr(true),
	})
	if err != nil {
		return fmt.Errorf("vector: upsert: %w", err)
	}
	return nil
}

// Stats reports the index health for monitoring/metrics.
type Stats struct {
	Collection string `json:"collection"`
	Indexed    uint64 `json:"indexed"`
	Healthy    bool   `json:"healthy"`
}

// Stats returns how many cover embeddings are currently indexed.
func (s *Service) Stats(ctx context.Context) (Stats, error) {
	if s.client == nil {
		return Stats{Collection: CollectionName, Healthy: false}, ErrUnavailable
	}
	n, err := s.client.Count(ctx, &qdrant.CountPoints{
		CollectionName: CollectionName,
	})
	if err != nil {
		return Stats{Collection: CollectionName, Healthy: false}, err
	}
	return Stats{
		Collection: CollectionName,
		Indexed:    n,
		Healthy:    true,
	}, nil
}

// Search returns the nearest cover embeddings to the given vector.
func (s *Service) Search(ctx context.Context, vector []float32, limit int, scoreThreshold float32) (matches []Match, err error) {
	started := time.Now()
	if s.metrics != nil {
		defer func() {
			status := 200
			if err != nil {
				status = 503
			}
			s.metrics.RecordDependency(ctx, "qdrant", "search", err == nil, status, time.Since(started), "")
		}()
	}
	if s.client == nil {
		return nil, ErrUnavailable
	}
	if limit <= 0 {
		limit = 10
	}
	res, err := s.client.Query(ctx, &qdrant.QueryPoints{
		CollectionName: CollectionName,
		Query:          qdrant.NewQueryDense(vector),
		Limit:          uint64Ptr(uint64(limit)),
		WithPayload:    qdrant.NewWithPayloadInclude("game_id", "release_id", "title", "platform", "region", "cover_url"),
		ScoreThreshold: &scoreThreshold,
	})
	if err != nil {
		return nil, fmt.Errorf("vector: search: %w", err)
	}

	matches = make([]Match, 0, len(res))
	for _, sc := range res {
		payload := sc.GetPayload()
		m := Match{
			Similarity: float64(sc.GetScore()),
		}
		if v, ok := payload["game_id"]; ok {
			m.GameID = strVal(v)
		}
		if v, ok := payload["release_id"]; ok {
			m.ReleaseID = strVal(v)
		}
		if v, ok := payload["title"]; ok {
			m.Title = strVal(v)
		}
		if v, ok := payload["platform"]; ok {
			m.Platform = strVal(v)
		}
		if v, ok := payload["region"]; ok {
			m.Region = strVal(v)
		}
		if v, ok := payload["cover_url"]; ok {
			m.CoverURL = strVal(v)
		}
		matches = append(matches, m)
	}
	return matches, nil
}

func strVal(v *qdrant.Value) string {
	if v == nil {
		return ""
	}
	return v.GetStringValue()
}

func boolPtr(b bool) *bool { return &b }

func uint64Ptr(n uint64) *uint64 { return &n }
