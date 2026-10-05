package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	ServerPort       string
	DBHost           string
	DBPort           string
	DBUser           string
	DBPassword       string
	DBName           string
	DBSSLMode        string
	JWTSecret        string
	Environment      string
	TLSCertFile      string
	TLSKeyFile       string
	TLSTerminated    bool
	CORSOrigins      string
	GeminiAPIKey     string
	GeminiModel      string
	GeminiTimeout    time.Duration
	ResendAPIKey     string
	MailFrom         string
	PasswordResetURL string
	PasswordResetTTL time.Duration

	// ScreenScraper API credentials (see docs/screenscraper-api.md)
	SSDevID        string
	SSDevPassword  string
	SSSoftName     string
	SSUserID       string
	SSUserPassword string
	SSBaseURL      string
	SSTimeout      time.Duration
	SSMinDelay     time.Duration
	SSMaxRetry     int
	SSCacheTTL     time.Duration

	// MediaRateLimit / MediaRateWindow cap per-IP requests on the public
	// media proxy (defaults: 60 requests per minute).
	MediaRateLimit  int
	MediaRateWindow time.Duration
}

func Load() *Config {
	return &Config{
		ServerPort:       getEnv("SERVER_PORT", "8080"),
		DBHost:           getEnv("DB_HOST", "localhost"),
		DBPort:           getEnv("DB_PORT", "5432"),
		DBUser:           getEnv("DB_USER", "postgres"),
		DBPassword:       getEnv("DB_PASSWORD", "postgres"),
		DBName:           getEnv("DB_NAME", "cartrune"),
		DBSSLMode:        getEnv("DB_SSLMODE", "disable"),
		JWTSecret:        getEnv("JWT_SECRET", "change-me-in-production"),
		Environment:      getEnv("APP_ENV", "development"),
		TLSCertFile:      getEnv("TLS_CERT_FILE", ""),
		TLSKeyFile:       getEnv("TLS_KEY_FILE", ""),
		TLSTerminated:    getEnvBool("TLS_TERMINATED", false),
		CORSOrigins:      getEnv("CORS_ORIGINS", "*"),
		GeminiAPIKey:     getEnv("GEMINI_API_KEY", ""),
		GeminiModel:      getEnv("GEMINI_MODEL", "gemini-2.5-flash-lite"),
		GeminiTimeout:    getEnvDuration("GEMINI_TIMEOUT", 45*time.Second),
		ResendAPIKey:     getEnv("RESEND_API_KEY", ""),
		MailFrom:         getEnv("MAIL_FROM", "CartRune <onboarding@resend.dev>"),
		PasswordResetURL: getEnv("PASSWORD_RESET_URL", "cartrune://reset-password"),
		PasswordResetTTL: getEnvDuration("PASSWORD_RESET_TTL", 30*time.Minute),

		SSDevID:        getEnv("SS_DEVID", ""),
		SSDevPassword:  getEnv("SS_DEVPASSWORD", ""),
		SSSoftName:     getEnv("SS_SOFTNAME", "CartRune"),
		SSUserID:       getEnv("SS_USERID", ""),
		SSUserPassword: getEnv("SS_USERPASSWORD", ""),
		SSBaseURL:      getEnv("SS_BASE_URL", "https://api.screenscraper.fr/api2/"),
		SSTimeout:      getEnvDuration("SS_TIMEOUT", 20*time.Second),
		SSMinDelay:     getEnvDuration("SS_MIN_DELAY", 1500*time.Millisecond),
		SSMaxRetry:     getEnvInt("SS_MAX_RETRY", 2),
		SSCacheTTL:     getEnvDuration("SS_CACHE_TTL", 2*time.Minute),

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

func getEnvBool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
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
