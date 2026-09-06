package scanner

import (
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
)

func Routes(app fiber.Router, handler *Handler, jwtSecret string) {
	scanner := app.Group("/scanner")

	scanner.Post("/barcode", middleware.JWTAuth(jwtSecret), handler.Barcode)
	scanner.Post("/text", middleware.JWTAuth(jwtSecret), handler.Text)
	scanner.Post("/match", middleware.JWTAuth(jwtSecret), handler.Match)
	scanner.Get("/stats", middleware.JWTAuth(jwtSecret), handler.Stats)
}
