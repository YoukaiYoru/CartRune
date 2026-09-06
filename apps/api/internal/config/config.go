package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	ServerPort string
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	JWTSecret  string

	// ScreenScraper API credentials (see docs/screenscraper-api.md)
	SSDevID        string
	SSDevPassword  string
	SSSoftName     string
	SSUserID       string
	SSUserPassword string

	// MediaCacheDir is where proxied covers are cached to disk (default
	// ./data/covers). Client-facing cover URLs never contain credentials.
	MediaCacheDir string

	// MediaRateLimit / MediaRateWindow cap per-IP requests on the public
	// media proxy (defaults: 60 requests per minute).
	MediaRateLimit  int
	MediaRateWindow time.Duration
}

func Load() *Config {
	return &Config{
		ServerPort: getEnv("SERVER_PORT", "8080"),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "postgres"),
		DBName:     getEnv("DB_NAME", "cartrune"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),
		JWTSecret:  getEnv("JWT_SECRET", "change-me-in-production"),

		SSDevID:        getEnv("SS_DEVID", ""),
		SSDevPassword:  getEnv("SS_DEVPASSWORD", ""),
		SSSoftName:     getEnv("SS_SOFTNAME", "CartRune"),
		SSUserID:       getEnv("SS_USERID", ""),
		SSUserPassword: getEnv("SS_USERPASSWORD", ""),

		MediaCacheDir:   getEnv("MEDIA_CACHE_DIR", "data/covers"),
		MediaRateLimit:  getEnvInt("MEDIA_RATE_LIMIT", 60),
		MediaRateWindow: getEnvDuration("MEDIA_RATE_WINDOW", time.Minute),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// getEnvInt reads an integer env var, falling back to def on any error.
func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

// getEnvDuration reads a duration env var (e.g. "1m", "30s"), falling back to
// def on any error.
func getEnvDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}
