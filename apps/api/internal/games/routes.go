package games

import (
	"github.com/gofiber/fiber/v3"
)

func Routes(app fiber.Router, handler *Handler) {
	games := app.Group("/games")

	games.Get("", handler.ListGames)
	games.Get("/search", handler.SearchGames)
	games.Get("/:id", handler.GetGame)
	games.Get("/:id/releases", handler.GetReleases)
	games.Get("/:id/covers", handler.GetCovers)
}
