package reviews

import (
	"github.com/YoukaiYoru/api/pkg/middleware"
	"github.com/gofiber/fiber/v3"
)

func Routes(app fiber.Router, handler *Handler, jwtSecret string) {
	reviews := app.Group("/reviews")

	// Public routes
	reviews.Get("/:id/comments", handler.GetComments)

	// Protected routes
	reviews.Post("/:id/like", middleware.JWTAuth(jwtSecret), handler.LikeReview)
	reviews.Delete("/:id/like", middleware.JWTAuth(jwtSecret), handler.UnlikeReview)
	reviews.Post("/:id/comments", middleware.JWTAuth(jwtSecret), handler.AddComment)

	// Game reviews are routes under /games
	games := app.Group("/games")
	games.Get("/:id/reviews", handler.GetGameReviews)
	games.Post("/:id/reviews", middleware.JWTAuth(jwtSecret), handler.CreateReview)

	// Review CRUD
	reviews.Patch("/:id", middleware.JWTAuth(jwtSecret), handler.UpdateReview)
	reviews.Delete("/:id", middleware.JWTAuth(jwtSecret), handler.DeleteReview)
}
