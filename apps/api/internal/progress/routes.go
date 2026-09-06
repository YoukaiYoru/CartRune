package progress

import (
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
)

func Routes(app fiber.Router, handler *Handler, jwtSecret string) {
	games := app.Group("/games")

	games.Patch("/:id/progress", middleware.JWTAuth(jwtSecret), handler.UpdateProgress)
	games.Post("/:id/start", middleware.JWTAuth(jwtSecret), handler.StartGame)
	games.Post("/:id/complete", middleware.JWTAuth(jwtSecret), handler.CompleteGame)
}
