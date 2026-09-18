package observability

import (
	"context"
	"time"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Recorder struct{ db *gorm.DB }

func NewRecorder(db *gorm.DB) *Recorder { return &Recorder{db: db} }

func (r *Recorder) RecordScan(ctx context.Context, userID uuid.UUID, method, outcome, fallback string, confidence *float64, duration time.Duration, errorCode string) {
	if r == nil || r.db == nil {
		return
	}
	_ = r.db.WithContext(ctx).Create(&models.ScanMetric{ID: uuid.New(), UserID: userID, Method: method, Outcome: outcome, Fallback: fallback, Confidence: confidence, DurationMS: duration.Milliseconds(), ErrorCode: errorCode, CreatedAt: time.Now()}).Error
}

func (r *Recorder) RecordDependency(ctx context.Context, service, operation string, success bool, status int, duration time.Duration, errorCode string) {
	if r == nil || r.db == nil {
		return
	}
	_ = r.db.WithContext(ctx).Create(&models.DependencyMetric{ID: uuid.New(), Service: service, Operation: operation, Success: success, Status: status, DurationMS: duration.Milliseconds(), ErrorCode: errorCode, CreatedAt: time.Now()}).Error
}
