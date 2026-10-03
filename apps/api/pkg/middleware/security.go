package middleware

import "github.com/gofiber/fiber/v3"

// SecurityHeaders adds response headers that are safe for the JSON API and
// reduce browser-side content sniffing and framing risks.
func SecurityHeaders(secureTransport bool) fiber.Handler {
	return func(c fiber.Ctx) error {
		c.Set("X-Content-Type-Options", "nosniff")
		c.Set("X-Frame-Options", "DENY")
		c.Set("Referrer-Policy", "no-referrer")
		c.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		if secureTransport {
			c.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		return c.Next()
	}
}
