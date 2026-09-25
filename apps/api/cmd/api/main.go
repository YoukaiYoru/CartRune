package main

import (
	"context"
	"crypto/tls"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/YoukaiYoru/api/internal/auth"
	"github.com/YoukaiYoru/api/internal/collections"
	"github.com/YoukaiYoru/api/internal/config"
	"github.com/YoukaiYoru/api/internal/embeddings"
	"github.com/YoukaiYoru/api/internal/games"
	"github.com/YoukaiYoru/api/internal/media"
	"github.com/YoukaiYoru/api/internal/models"
	"github.com/YoukaiYoru/api/internal/observability"
	"github.com/YoukaiYoru/api/internal/progress"
	"github.com/YoukaiYoru/api/internal/reviews"
	"github.com/YoukaiYoru/api/internal/scanner"
	"github.com/YoukaiYoru/api/internal/screenscraper"
	"github.com/YoukaiYoru/api/internal/social"
	"github.com/YoukaiYoru/api/internal/users"
	"github.com/YoukaiYoru/api/internal/vector"
	"github.com/YoukaiYoru/api/pkg/database"
	"github.com/gofiber/fiber/v3"
	"github.com/joho/godotenv"
	"gorm.io/gorm"
)

func main() {
	loadEnv()

	cfg := config.Load()
	if cfg.Environment == "production" && cfg.JWTSecret == "change-me-in-production" {
		log.Fatal("JWT_SECRET must be configured in production")
	}
	if cfg.Environment == "production" && (cfg.DBPassword == "" || cfg.DBPassword == "postgres") {
		log.Fatal("DB_PASSWORD must be configured in production")
	}
	if cfg.Environment == "production" && (cfg.TLSCertFile == "" || cfg.TLSKeyFile == "") {
		log.Fatal("TLS_CERT_FILE and TLS_KEY_FILE must be configured in production")
	}
	if cfg.Environment == "production" && strings.TrimSpace(cfg.CORSOrigins) == "*" {
		log.Fatal("CORS_ORIGINS must be explicit in production")
	}
	db := database.Connect(cfg)
	metrics := observability.NewRecorder(db)

	// Media proxy: serves covers publicly (no JWT) without exposing the
	// ScreenScraper credentials embedded in the original media URLs. A per-IP
	// rate limit protects the ScreenScraper quota (see docs §8).
	mediaSvc := media.NewService(media.Options{
		DevID:        cfg.SSDevID,
		DevPassword:  cfg.SSDevPassword,
		SoftName:     cfg.SSSoftName,
		UserID:       cfg.SSUserID,
		UserPassword: cfg.SSUserPassword,
		RateLimit:    cfg.MediaRateLimit,
		RateWindow:   cfg.MediaRateWindow,
		DB:           db,
	})

	if err := db.AutoMigrate(
		&models.User{},
		&models.RefreshToken{},
		&models.Game{},
		&models.Platform{},
		&models.GamePlatform{},
		&models.Release{},
		&models.Cover{},
		&models.Library{},
		&models.LibraryGame{},
		&models.Review{},
		&models.ReviewLike{},
		&models.Comment{},
		&models.Follow{},
		&models.Activity{},
		&models.ScanMetric{},
		&models.DependencyMetric{},
		&models.RateLimitBucket{},
	); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}
	if err := ensureLibraryGameKey(db); err != nil {
		log.Fatalf("failed to migrate library games key: %v", err)
	}
	if err := ensureCoverReleaseKeys(db); err != nil {
		log.Fatalf("failed to migrate cover release keys: %v", err)
	}

	// Strip ScreenScraper credentials from covers persisted before the media
	// proxy existed (they are re-attached server-side at fetch time).
	if err := mediaSvc.CleanupStoredURLs(context.Background()); err != nil {
		log.Printf("WARN: failed to clean stored cover urls: %v", err)
	}

	app := fiber.New(fiber.Config{
		AppName:      "CartRune API",
		BodyLimit:    8 * 1024 * 1024,
		ErrorHandler: customErrorHandler,
	})
	configureCORS(app, cfg.CORSOrigins)
	app.Get("/health/live", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	api := app.Group("/api/v1")

	// Auth
	authRepo := auth.NewRepository(db)
	authService := auth.NewService(authRepo, cfg)
	authHandler := auth.NewHandler(authService)
	auth.Routes(api, authHandler, cfg.JWTSecret)

	// Users
	usersRepo := users.NewRepository(db)
	usersService := users.NewService(usersRepo)
	usersHandler := users.NewHandler(usersService)
	users.Routes(api, usersHandler, cfg.JWTSecret)

	// Games
	gamesRepo := games.NewRepository(db)
	gamesService := games.NewService(gamesRepo)
	gamesHandler := games.NewHandler(gamesService)
	games.Routes(api, gamesHandler)

	// Catalog provider is also used as the scanner fallback. The mobile app
	// still only sees CartRune's normalized scanner contract.
	ssClient := screenscraper.New(screenscraper.Options{
		BaseURL:      cfg.SSBaseURL,
		DevID:        cfg.SSDevID,
		DevPassword:  cfg.SSDevPassword,
		SoftName:     cfg.SSSoftName,
		UserID:       cfg.SSUserID,
		UserPassword: cfg.SSUserPassword,
		Timeout:      cfg.SSTimeout,
		MinDelay:     cfg.SSMinDelay,
		MaxRetry:     cfg.SSMaxRetry,
		Metrics:      metrics,
	})
	if !ssClient.CredentialsConfigured() {
		log.Printf("WARN: catalog provider credentials are not set; catalog enrichment is unavailable")
	}
	ssService := screenscraper.NewServiceWithOptions(ssClient, db, screenscraper.ServiceOptions{CacheTTL: cfg.SSCacheTTL})
	ssHandler := screenscraper.NewHandler(ssService)
	screenscraper.Routes(api, ssHandler, cfg.JWTSecret)

	// Scanner
	vectorSvc := vector.NewService(vector.Options{
		Host:    cfg.QdrantHost,
		Port:    cfg.QdrantPort,
		APIKey:  cfg.QdrantAPIKey,
		Metrics: metrics,
	})
	if !vectorSvc.Healthy(context.Background()) {
		log.Printf("WARN: Qdrant unreachable (%s:%d); visual matching (/scanner/match) will be unavailable", cfg.QdrantHost, cfg.QdrantPort)
	} else if err := vectorSvc.EnsureCollection(context.Background(), vector.DefaultDims); err != nil {
		log.Printf("WARN: Qdrant collection setup failed: %v", err)
	}
	app.Get("/health/ready", func(c fiber.Ctx) error {
		sqlDB, err := db.DB()
		if err != nil || sqlDB.PingContext(c.Context()) != nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "database not ready")
		}
		vectorReady := vectorSvc.Healthy(c.Context())
		status := "ready"
		if !vectorReady {
			status = "degraded"
		}
		return c.JSON(fiber.Map{
			"status": status,
			"dependencies": fiber.Map{
				"database": "ready",
				"vector":   map[bool]string{true: "ready", false: "degraded"}[vectorReady],
			},
		})
	})
	scannerService := scanner.NewService(gamesRepo, vectorSvc, ssService)
	scannerHandler := scanner.NewHandler(scannerService, metrics)
	scanner.Routes(api, scannerHandler, cfg.JWTSecret)
	embeddings.Routes(api, embeddings.NewProxy(cfg.EmbeddingsURL, metrics), cfg.JWTSecret)

	media.Routes(api, mediaSvc)

	// Social (feed activity) -> consumed by collections/progress/reviews
	socialRepo := social.NewRepository(db)
	socialService := social.NewService(socialRepo)
	socialHandler := social.NewHandler(socialService)
	social.Routes(api, socialHandler, cfg.JWTSecret)

	// Libraries (Collections)
	collectionsRepo := collections.NewRepository(db)
	collectionsService := collections.NewService(collectionsRepo, socialService.RecordActivity)
	collectionsHandler := collections.NewHandler(collectionsService)
	collections.Routes(api, collectionsHandler, cfg.JWTSecret)

	// Progress
	progressService := progress.NewService(collectionsService, collectionsRepo, socialService.RecordActivity)
	progressHandler := progress.NewHandler(progressService)
	progress.Routes(api, progressHandler, cfg.JWTSecret)

	// Reviews
	reviewsRepo := reviews.NewRepository(db)
	reviewsService := reviews.NewService(reviewsRepo, socialService.RecordActivity)
	reviewsHandler := reviews.NewHandler(reviewsService)
	reviews.Routes(api, reviewsHandler, cfg.JWTSecret)

	log.Printf("CartRune API starting on port %s", cfg.ServerPort)
	listenConfig := fiber.ListenConfig{TLSMinVersion: tls.VersionTLS13}
	if cfg.TLSCertFile != "" || cfg.TLSKeyFile != "" {
		listenConfig.CertFile = cfg.TLSCertFile
		listenConfig.CertKeyFile = cfg.TLSKeyFile
	}
	if err := app.Listen(":"+cfg.ServerPort, listenConfig); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func configureCORS(app *fiber.App, raw string) {
	allowed := map[string]bool{}
	for _, origin := range strings.Split(raw, ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			allowed[origin] = true
		}
	}
	app.Use(func(c fiber.Ctx) error {
		origin := c.Get("Origin")
		if origin != "" && !allowed["*"] && !allowed[origin] {
			return fiber.NewError(fiber.StatusForbidden, "origin not allowed")
		}
		if origin != "" {
			if allowed["*"] {
				c.Set("Access-Control-Allow-Origin", "*")
			} else {
				c.Set("Access-Control-Allow-Origin", origin)
				c.Set("Vary", "Origin")
			}
			c.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		}
		if c.Method() == "OPTIONS" {
			return c.SendStatus(fiber.StatusNoContent)
		}
		return c.Next()
	})
}

// ensureLibraryGameKey upgrades databases created with the original
// LibraryGame primary key (library_id only). A library can contain multiple
// games, so the pair must be unique instead.
func ensureLibraryGameKey(db *gorm.DB) error {
	return db.Exec(`
		ALTER TABLE library_games DROP CONSTRAINT IF EXISTS library_games_pkey;
		ALTER TABLE library_games DROP CONSTRAINT IF EXISTS pk_library_games;
		ALTER TABLE library_games ADD CONSTRAINT pk_library_games PRIMARY KEY (library_id, game_id);
	`).Error
}

// ensureCoverReleaseKeys repairs covers imported before ReleaseID was stored.
// Existing rows are linked to the official release for their game; new imports
// persist the exact release selected from ScreenScraper.
func ensureCoverReleaseKeys(db *gorm.DB) error {
	return db.Exec(`
		UPDATE covers AS c
		SET release_id = (
			SELECT r.id
			FROM releases AS r
			WHERE r.game_id = c.game_id
			ORDER BY r.official DESC, r.created_at ASC, r.id ASC
			LIMIT 1
		)
		WHERE (c.release_id IS NULL OR c.release_id = '00000000-0000-0000-0000-000000000000')
		  AND EXISTS (SELECT 1 FROM releases AS r2 WHERE r2.game_id = c.game_id)
	`).Error
}

// loadEnv loads the .env file so configuration can live in apps/api/.env.
// It searches upward from the current working directory so the server runs
// correctly regardless of where it is launched from. Existing environment
// variables always take precedence over .env values.
func loadEnv() {
	dir, err := os.Getwd()
	if err != nil {
		log.Printf("WARN: could not determine working directory: %v", err)
		return
	}

	for {
		path := filepath.Join(dir, ".env")
		if _, statErr := os.Stat(path); statErr == nil {
			if loadErr := godotenv.Load(path); loadErr != nil {
				log.Printf("WARN: failed to load .env at %s: %v", path, loadErr)
			} else {
				log.Printf("Loaded config from %s", path)
			}
			return
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return
		}
		dir = parent
	}
}

func customErrorHandler(c fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	return c.Status(code).JSON(fiber.Map{
		"error": err.Error(),
	})
}
