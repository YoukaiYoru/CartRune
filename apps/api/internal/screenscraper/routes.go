package screenscraper

import (
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
)

func Routes(app fiber.Router, handler *Handler, jwtSecret string) {
	// Provider-neutral routes: the mobile client talks to CartRune's catalog,
	// never to a provider-named API surface.
	ss := app.Group("/catalog", middleware.JWTAuth(jwtSecret))

	ss.Post("/search", handler.Search)
	ss.Get("/games/:id", handler.Detail)
	ss.Post("/games/:id/import", handler.Import)
}
