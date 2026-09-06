package collections

import (
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
)

func Routes(app fiber.Router, handler *Handler, jwtSecret string) {
	libs := app.Group("/libraries")

	// Protected routes
	libs.Get("", middleware.JWTAuth(jwtSecret), handler.ListLibraries)
	libs.Post("", middleware.JWTAuth(jwtSecret), handler.CreateLibrary)
	libs.Get("/:id", handler.GetLibrary)
	libs.Patch("/:id", middleware.JWTAuth(jwtSecret), handler.UpdateLibrary)
	libs.Delete("/:id", middleware.JWTAuth(jwtSecret), handler.DeleteLibrary)

	libs.Post("/:id/games", middleware.JWTAuth(jwtSecret), handler.AddGame)
	libs.Delete("/:id/games/:gameId", middleware.JWTAuth(jwtSecret), handler.RemoveGame)
}
