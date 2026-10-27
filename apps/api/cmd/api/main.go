package main

import (
	"crypto/tls"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/YoukaiYoru/api/internal/auth"
	"github.com/YoukaiYoru/api/internal/collections"
	"github.com/YoukaiYoru/api/internal/config"
	"github.com/YoukaiYoru/api/internal/games"
	"github.com/YoukaiYoru/api/internal/gemini"
	"github.com/YoukaiYoru/api/internal/media"
	"github.com/YoukaiYoru/api/internal/observability"
	"github.com/YoukaiYoru/api/internal/progress"
	"github.com/YoukaiYoru/api/internal/reviews"
	"github.com/YoukaiYoru/api/internal/scanner"
	"github.com/YoukaiYoru/api/internal/screenscraper"
	"github.com/YoukaiYoru/api/internal/social"
	"github.com/YoukaiYoru/api/internal/users"
	"github.com/YoukaiYoru/api/pkg/database"
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/gofiber/fiber/v3/middleware/timeout"
	"github.com/joho/godotenv"
)

func main() {
	loadEnv()

	cfg := config.Load()
	if cfg.Environment == "production" && cfg.JWTSecret == "change-me-in-production" {
		log.Fatal("JWT_SECRET must be configured in production")
	}
	if cfg.Environment == "production" && len(cfg.JWTSecret) < 32 {
		log.Fatal("JWT_SECRET must be at least 32 characters in production")
	}
	if cfg.Environment == "production" && (cfg.DBPassword == "" || cfg.DBPassword == "postgres") {
		log.Fatal("DB_PASSWORD must be configured in production")
	}
	if cfg.Environment == "production" && cfg.DBSSLMode == "disable" {
		log.Fatal("DB_SSLMODE must enable TLS in production")
	}
	if cfg.Environment == "production" && !cfg.TLSTerminated && (cfg.TLSCertFile == "" || cfg.TLSKeyFile == "") {
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

	app := fiber.New(fiber.Config{
		AppName:     "CartRune API",
		BodyLimit:   8 * 1024 * 1024,
		TrustProxy:  true,
		ProxyHeader: fiber.HeaderXForwardedFor,
		TrustProxyConfig: fiber.TrustProxyConfig{
			Private:  true,
			Loopback: true,
		},
		ErrorHandler: customErrorHandler,
	})
	app.Use(requestid.New())
	app.Use(recover.New())
	app.Use(timeout.New(func(c fiber.Ctx) error { return c.Next() }, timeout.Config{Timeout: 60 * time.Second}))
	app.Use(middleware.SecurityHeaders(cfg.Environment == "production"))
	configureCORS(app, cfg.CORSOrigins)
	app.Get("/health/live", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})
	app.Use(limiter.New(limiter.Config{
		Max:        120,
		Expiration: time.Minute,
		KeyGenerator: func(c fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c fiber.Ctx) error {
			return fiber.NewError(fiber.StatusTooManyRequests, "too many requests")
		},
	}))

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

	// Scanner uses Gemini for image metadata, then ScreenScraper for catalog search.
	geminiClient := gemini.New(cfg.GeminiAPIKey, cfg.GeminiModel, cfg.GeminiTimeout)
	if !geminiClient.Configured() {
		log.Printf("WARN: GEMINI_API_KEY is not configured; photo scanning is unavailable")
	}
	app.Get("/health/ready", func(c fiber.Ctx) error {
		sqlDB, err := db.DB()
		if err != nil || sqlDB.PingContext(c.Context()) != nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "database not ready")
		}
		status := "ready"
		if !geminiClient.Configured() {
			status = "degraded"
		}
		return c.JSON(fiber.Map{
			"status": status,
			"dependencies": fiber.Map{
				"database": "ready",
				"gemini":   map[bool]string{true: "ready", false: "degraded"}[geminiClient.Configured()],
			},
		})
	})
	scannerService := scanner.NewService(gamesRepo, ssService)
	scannerHandler := scanner.NewHandler(scannerService, geminiClient, metrics)
	scanner.Routes(api, scannerHandler, cfg.JWTSecret)

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
	errCh := make(chan error, 1)
	go func() { errCh <- app.Listen(":"+cfg.ServerPort, listenConfig) }()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	select {
	case err := <-errCh:
		if err != nil {
			log.Fatalf("failed to start server: %v", err)
		}
	case <-stop:
		log.Println("shutting down CartRune API")
		if err := app.Shutdown(); err != nil {
			log.Printf("graceful shutdown failed: %v", err)
		}
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
	if code >= 500 {
		log.Printf("request_id=%s status=%d error=%v", c.GetRespHeader("X-Request-ID"), code, err)
		return c.Status(code).JSON(fiber.Map{"error": "internal server error"})
	}
	return c.Status(code).JSON(fiber.Map{
		"error": err.Error(),
	})
}
