package users

import (
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
)

func Routes(app fiber.Router, handler *Handler, jwtSecret string) {
	users := app.Group("/users")

	users.Get("/:username", handler.GetProfile)

	// Protected routes
	users.Patch("/me", middleware.JWTAuth(jwtSecret), handler.UpdateProfile)
}
