package auth

import (
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
)

func Routes(app fiber.Router, handler *Handler, jwtSecret string) {
	auth := app.Group("/auth")

	auth.Post("/register", handler.Register)
	auth.Post("/login", handler.Login)
	auth.Post("/refresh", handler.Refresh)
	auth.Post("/logout", handler.Logout)

	// Protected route
	app.Get("/me", middleware.JWTAuth(jwtSecret), handler.Me)
}
