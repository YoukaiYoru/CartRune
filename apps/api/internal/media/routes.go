package media

import (
	"github.com/gofiber/fiber/v3"
)

// Routes registers the media proxy endpoints under /media. The routes are
// PUBLIC (no JWT) so image URLs can be used directly by the mobile <Image>
// component; the underlying ScreenScraper URLs are never exposed to clients
// (credentials are re-attached only server-side at fetch time). Abuse of the
// ScreenScraper quota is mitigated by a per-IP rate limit.
func Routes(app fiber.Router, service *Service) {
	m := app.Group("/media")

	// Public rate-limited proxy.
	m.Use(service.RateLimit())

	// Persisted cover by local UUID.
	m.Get("/covers/:id", service.ServeCover)
	// On-the-fly ScreenScraper game media (?media=box-2D(eu)).
	m.Get("/games/:systemeid/:jeuid", service.ServeGameMedia)
}
