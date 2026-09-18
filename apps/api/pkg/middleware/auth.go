package middleware

import (
	"strings"

	"github.com/YoukaiYoru/api/pkg/response"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID    uuid.UUID `json:"user_id"`
	TokenType string    `json:"token_type"`
	jwt.RegisteredClaims
}

func JWTAuth(secret string) fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return response.Error(c, fiber.StatusUnauthorized, "missing authorization header")
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return response.Error(c, fiber.StatusUnauthorized, "invalid authorization format")
		}

		tokenStr := parts[1]
		token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
			if t.Method != jwt.SigningMethodHS256 {
				return nil, jwt.ErrTokenSignatureInvalid
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			return response.Error(c, fiber.StatusUnauthorized, "invalid or expired token")
		}

		claims, ok := token.Claims.(*Claims)
		if !ok {
			return response.Error(c, fiber.StatusUnauthorized, "invalid token claims")
		}
		if claims.TokenType != "access" {
			return response.Error(c, fiber.StatusUnauthorized, "invalid token type")
		}

		c.Locals("user_id", claims.UserID)
		return c.Next()
	}
}

// GetUserID returns the authenticated user id stored in the request context,
// or uuid.Nil when it is absent or of the wrong type (never panics).
func GetUserID(c fiber.Ctx) uuid.UUID {
	id, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return uuid.Nil
	}
	return id
}
