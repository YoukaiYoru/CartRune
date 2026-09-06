package social

import (
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
)

func Routes(app fiber.Router, handler *Handler, jwtSecret string) {
	// Protected routes
	app.Post("/users/:id/follow", middleware.JWTAuth(jwtSecret), handler.Follow)
	app.Delete("/users/:id/follow", middleware.JWTAuth(jwtSecret), handler.Unfollow)

	app.Get("/feed", middleware.JWTAuth(jwtSecret), handler.GetFeed)
}
