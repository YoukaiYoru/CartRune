package scanner

import (
	"time"

	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
)

func Routes(app fiber.Router, handler *Handler, jwtSecret string) {
	scanner := app.Group("/scanner")

	scanner.Post("/text", middleware.JWTAuth(jwtSecret), limiter.New(scanLimit(30)), handler.Text)
	scanner.Post("/analyze", middleware.JWTAuth(jwtSecret), limiter.New(scanLimit(5)), handler.AnalyzeCover)
}

func scanLimit(max int) limiter.Config {
	return limiter.Config{
		Max:        max,
		Expiration: time.Minute,
		KeyGenerator: func(c fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c fiber.Ctx) error {
			return fiber.NewError(fiber.StatusTooManyRequests, "too many scan requests")
		},
	}
}
