package response

import (
	"github.com/gofiber/fiber/v3"
)

type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

type SuccessResponse struct {
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

func JSON(c fiber.Ctx, status int, data interface{}) error {
	return c.Status(status).JSON(data)
}

func Error(c fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(ErrorResponse{
		Error: message,
	})
}

func ErrorWithDetails(c fiber.Ctx, status int, message, details string) error {
	return c.Status(status).JSON(ErrorResponse{
		Error:   message,
		Details: details,
	})
}

func Created(c fiber.Ctx, data interface{}) error {
	return c.Status(fiber.StatusCreated).JSON(SuccessResponse{
		Data: data,
	})
}

func Success(c fiber.Ctx, data interface{}) error {
	return c.Status(fiber.StatusOK).JSON(SuccessResponse{
		Data: data,
	})
}

func NoContent(c fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNoContent)
}
