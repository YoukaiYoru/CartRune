package embeddings

import (
	"time"

	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
)

func Routes(app fiber.Router, proxy *Proxy, jwtSecret string) {
	group := app.Group("/scanner")
	group.Post("/embed", middleware.JWTAuth(jwtSecret), limiter.New(heavyLimit()), proxy.Embed)
	group.Post("/ocr", middleware.JWTAuth(jwtSecret), limiter.New(heavyLimit()), proxy.OCR)
	group.Post("/analyze", middleware.JWTAuth(jwtSecret), limiter.New(heavyLimit()), proxy.AnalyzeCover)
}

func heavyLimit() limiter.Config {
	return limiter.Config{
		Max:        10,
		Expiration: 5 * time.Minute,
		KeyGenerator: func(c fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c fiber.Ctx) error {
			return fiber.NewError(fiber.StatusTooManyRequests, "too many cover analysis requests")
		},
	}
}
