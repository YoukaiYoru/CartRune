package main

import (
	"context"
	"log"
	"os"
	"path/filepath"

	"github.com/YoukaiYoru/api/internal/auth"
	"github.com/YoukaiYoru/api/internal/collections"
	"github.com/YoukaiYoru/api/internal/config"
	"github.com/YoukaiYoru/api/internal/games"
	"github.com/YoukaiYoru/api/internal/media"
	"github.com/YoukaiYoru/api/internal/models"
	"github.com/YoukaiYoru/api/internal/progress"
	"github.com/YoukaiYoru/api/internal/reviews"
	"github.com/YoukaiYoru/api/internal/scanner"
	"github.com/YoukaiYoru/api/internal/screenscraper"
	"github.com/YoukaiYoru/api/internal/social"
	"github.com/YoukaiYoru/api/internal/users"
	"github.com/YoukaiYoru/api/pkg/database"
	"github.com/gofiber/fiber/v3"
	"github.com/joho/godotenv"
)

func main() {
	loadEnv()

	cfg := config.Load()
	db := database.Connect(cfg)

	// Media proxy: serves covers publicly (no JWT) without exposing the
	// ScreenScraper credentials embedded in the original media URLs. A per-IP
	// rate limit protects the ScreenScraper quota (see docs §8).
	mediaSvc := media.NewService(media.Options{
		CacheDir:     cfg.MediaCacheDir,
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
	); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	// Strip ScreenScraper credentials from covers persisted before the media
	// proxy existed (they are re-attached server-side at fetch time).
	if err := mediaSvc.CleanupStoredURLs(context.Background()); err != nil {
		log.Printf("WARN: failed to clean stored cover urls: %v", err)
	}

	app := fiber.New(fiber.Config{
		AppName:      "CartRune API",
		ErrorHandler: customErrorHandler,
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

	// Scanner
	scannerService := scanner.NewService(gamesRepo)
	scannerHandler := scanner.NewHandler(scannerService)
	scanner.Routes(api, scannerHandler, cfg.JWTSecret)

	// ScreenScraper (game catalog + covers, see docs/screenscraper-api.md)
	ssClient := screenscraper.New(screenscraper.Options{
		DevID:        cfg.SSDevID,
		DevPassword:  cfg.SSDevPassword,
		SoftName:     cfg.SSSoftName,
		UserID:       cfg.SSUserID,
		UserPassword: cfg.SSUserPassword,
	})
	if !ssClient.CredentialsConfigured() {
		log.Printf("WARN: ScreenScraper credentials not set (SS_DEVID/SS_DEVPASSWORD); /screenscraper endpoints will return 500")
	}
	ssService := screenscraper.NewService(ssClient, db)
	ssHandler := screenscraper.NewHandler(ssService)
	screenscraper.Routes(api, ssHandler, cfg.JWTSecret)

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
	if err := app.Listen(":" + cfg.ServerPort); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
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
