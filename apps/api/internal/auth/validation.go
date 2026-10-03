package auth

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

var (
	ErrInvalidRegistration = errors.New("invalid registration data")
	ErrInvalidLogin        = errors.New("invalid login data")
	usernamePattern        = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]{1,49}$`)
	emailPattern           = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
)

const (
	minPasswordRunes = 12
	maxPasswordRunes = 128
)

func normalizeRegisterRequest(req RegisterRequest) (RegisterRequest, error) {
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if !usernamePattern.MatchString(req.Username) || utf8.RuneCountInString(req.Username) > 50 {
		return RegisterRequest{}, ErrInvalidRegistration
	}
	if len(req.Email) > 254 || !emailPattern.MatchString(req.Email) || !validPassword(req.Password) {
		return RegisterRequest{}, ErrInvalidRegistration
	}
	return req, nil
}

func normalizeLoginRequest(req LoginRequest) (LoginRequest, error) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if len(req.Email) > 254 || !emailPattern.MatchString(req.Email) || req.Password == "" {
		return LoginRequest{}, ErrInvalidLogin
	}
	return req, nil
}

func validPassword(password string) bool {
	runes := utf8.RuneCountInString(password)
	return runes >= minPasswordRunes && runes <= maxPasswordRunes
}
