package database

import (
	"fmt"
	"log"

	"github.com/YoukaiYoru/api/internal/config"
	"github.com/YoukaiYoru/api/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(cfg *config.Config) *gorm.DB {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to configure database pool: %v", err)
	}
	sqlDB.SetMaxOpenConns(cfg.DBMaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.DBMaxIdleConns)
	sqlDB.SetConnMaxLifetime(cfg.DBConnMaxLifetime)
	sqlDB.SetConnMaxIdleTime(cfg.DBConnMaxIdleTime)

	return db
}

// Migrate runs as a dedicated deployment step, not while serving traffic.
// PostgreSQL advisory locking prevents concurrent deployments from changing
// the schema at the same time.
func Migrate(db *gorm.DB) error {
	if err := db.Exec("SELECT pg_advisory_lock(782391)").Error; err != nil {
		return err
	}
	defer db.Exec("SELECT pg_advisory_unlock(782391)")

	if err := db.AutoMigrate(
		&models.User{}, &models.RefreshToken{}, &models.PasswordResetToken{},
		&models.Game{}, &models.Platform{}, &models.GamePlatform{}, &models.Release{},
		&models.Cover{}, &models.Library{}, &models.LibraryGame{}, &models.Review{},
		&models.ReviewLike{}, &models.Comment{}, &models.Follow{}, &models.Activity{},
		&models.ScanMetric{}, &models.DependencyMetric{}, &models.RateLimitBucket{},
	); err != nil {
		return err
	}
	if err := db.Exec(`
		ALTER TABLE library_games DROP CONSTRAINT IF EXISTS library_games_pkey;
		ALTER TABLE library_games DROP CONSTRAINT IF EXISTS pk_library_games;
		DO $$ BEGIN
			ALTER TABLE library_games ADD CONSTRAINT pk_library_games PRIMARY KEY (library_id, game_id);
		EXCEPTION WHEN duplicate_object THEN NULL;
		END $$;
	`).Error; err != nil {
		return err
	}
	return db.Exec(`
		UPDATE covers AS c
		SET release_id = (
			SELECT r.id FROM releases AS r WHERE r.game_id = c.game_id
			ORDER BY r.official DESC, r.created_at ASC, r.id ASC LIMIT 1
		)
		WHERE (c.release_id IS NULL OR c.release_id = '00000000-0000-0000-0000-000000000000')
		  AND EXISTS (SELECT 1 FROM releases AS r2 WHERE r2.game_id = c.game_id)
	`).Error
}
