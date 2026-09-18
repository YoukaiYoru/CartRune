package embeddings

import (
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
)

func Routes(app fiber.Router, proxy *Proxy, jwtSecret string) {
	group := app.Group("/scanner")
	group.Post("/embed", middleware.JWTAuth(jwtSecret), proxy.Embed)
	group.Post("/ocr", middleware.JWTAuth(jwtSecret), proxy.OCR)
	group.Post("/analyze", middleware.JWTAuth(jwtSecret), proxy.AnalyzeCover)
}
