package auth

import (
	"time"

	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/YoukaiYoru/api/pkg/response"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
)

func Routes(app fiber.Router, handler *Handler, jwtSecret string) {
	auth := app.Group("/auth")

	auth.Post("/register", limiter.New(authLimit(5)), handler.Register)
	auth.Post("/login", limiter.New(authLimit(10)), handler.Login)
	auth.Post("/refresh", limiter.New(authLimit(20)), handler.Refresh)
	auth.Post("/logout", handler.Logout)

	// Protected route
	app.Get("/me", middleware.JWTAuth(jwtSecret), handler.Me)
}

func authLimit(max int) limiter.Config {
	return limiter.Config{
		Max:        max,
		Expiration: time.Minute,
		KeyGenerator: func(c fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c fiber.Ctx) error {
			return response.Error(c, fiber.StatusTooManyRequests, "too many authentication attempts")
		},
	}
}
