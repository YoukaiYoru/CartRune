package auth

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/YoukaiYoru/api/internal/config"
	"github.com/YoukaiYoru/api/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
	"gorm.io/gorm"
)

type Service struct {
	repo *Repository
	cfg  *config.Config
}

func NewService(repo *Repository, cfg *config.Config) *Service {
	return &Service{repo: repo, cfg: cfg}
}

func (s *Service) Register(req RegisterRequest) (*TokenResponse, error) {
	var err error
	if req, err = normalizeRegisterRequest(req); err != nil {
		return nil, err
	}
	if existing, _ := s.repo.FindByEmail(req.Email); existing != nil {
		return nil, errors.New("email already registered")
	}
	if existing, _ := s.repo.FindByUsername(req.Username); existing != nil {
		return nil, errors.New("username already taken")
	}

	user := &models.User{
		ID:           uuid.New(),
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hashPassword(req.Password),
	}

	if err := s.repo.CreateWithDefaultLibrary(user); err != nil {
		return nil, err
	}

	return s.generateTokens(user.ID)
}

func (s *Service) Login(req LoginRequest) (*TokenResponse, error) {
	var err error
	if req, err = normalizeLoginRequest(req); err != nil {
		return nil, err
	}
	user, err := s.repo.FindByEmail(req.Email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid credentials")
		}
		return nil, err
	}

	if !verifyPassword(req.Password, user.PasswordHash) {
		return nil, errors.New("invalid credentials")
	}

	return s.generateTokens(user.ID)
}

func (s *Service) Refresh(refreshToken string) (*TokenResponse, error) {
	token, err := jwt.ParseWithClaims(refreshToken, &TokenClaims{}, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid refresh token")
	}

	claims, ok := token.Claims.(*TokenClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}
	if claims.TokenType != "refresh" {
		return nil, errors.New("invalid refresh token type")
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, errors.New("invalid user id in token")
	}
	consumedUserID, err := s.repo.ConsumeRefreshToken(hashToken(refreshToken))
	if err != nil || consumedUserID != userID {
		return nil, errors.New("refresh token revoked or expired")
	}

	return s.generateTokens(userID)
}

func (s *Service) Logout(refreshToken string) error {
	if strings.TrimSpace(refreshToken) == "" {
		return nil
	}
	return s.repo.RevokeRefreshToken(hashToken(refreshToken))
}

func (s *Service) RequestPasswordReset(email string) {
	email = strings.ToLower(strings.TrimSpace(email))
	user, err := s.repo.FindByEmail(email)
	if err != nil {
		// Deliberately do not reveal whether the address exists.
		return
	}

	rawTokenBytes := make([]byte, 32)
	if _, err := rand.Read(rawTokenBytes); err != nil {
		log.Printf("password reset token generation failed: %v", err)
		return
	}
	rawToken := base64.RawURLEncoding.EncodeToString(rawTokenBytes)
	if err := s.repo.CreatePasswordResetToken(&models.PasswordResetToken{
		ID: uuid.New(), UserID: user.ID, TokenHash: hashToken(rawToken),
		ExpiresAt: time.Now().Add(s.cfg.PasswordResetTTL),
	}); err != nil {
		log.Printf("password reset token persistence failed: %v", err)
		return
	}

	resetURL, err := url.Parse(s.cfg.PasswordResetURL)
	if err != nil {
		log.Printf("invalid PASSWORD_RESET_URL: %v", err)
		return
	}
	query := resetURL.Query()
	query.Set("token", rawToken)
	resetURL.RawQuery = query.Encode()
	if err := s.sendPasswordResetEmail(user.Email, resetURL.String()); err != nil {
		log.Printf("password reset email failed: %v", err)
	}
}

func (s *Service) ConfirmPasswordReset(token, password string) error {
	if strings.TrimSpace(token) == "" {
		return errors.New("invalid or expired reset token")
	}
	if err := validatePassword(password); err != nil {
		return err
	}
	return s.repo.ResetPassword(hashToken(token), hashPassword(password))
}

func (s *Service) sendPasswordResetEmail(recipient, resetURL string) error {
	if s.cfg.ResendAPIKey == "" || s.cfg.MailFrom == "" {
		return errors.New("RESEND_API_KEY and MAIL_FROM must be configured")
	}
	payload, err := json.Marshal(map[string]interface{}{
		"from":    s.cfg.MailFrom,
		"to":      []string{recipient},
		"subject": "Reset your CartRune password",
		"html":    fmt.Sprintf("<p>We received a request to reset your CartRune password.</p><p><a href=\"%s\">Reset password</a></p><p>This link expires in %d minutes and can only be used once.</p>", resetURL, int(s.cfg.PasswordResetTTL.Minutes())),
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.cfg.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("resend returned status %s", resp.Status)
	}
	return nil
}

func (s *Service) GetCurrentUser(userID uuid.UUID) (*models.User, error) {
	return s.repo.FindByID(userID)
}

func (s *Service) generateTokens(userID uuid.UUID) (*TokenResponse, error) {
	accessToken, err := s.createToken(userID, 15*time.Minute, "access")
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.createToken(userID, 7*24*time.Hour, "refresh")
	if err != nil {
		return nil, err
	}
	if err := s.repo.CreateRefreshToken(&models.RefreshToken{
		ID:        uuid.New(),
		UserID:    userID,
		TokenHash: hashToken(refreshToken),
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}); err != nil {
		return nil, err
	}

	return &TokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    900,
	}, nil
}

func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// TokenClaims are the claims embedded in access/refresh tokens. The user id is
// carried both as a structured claim and as the registered Subject so the
// middleware can read it reliably.
type TokenClaims struct {
	UserID    uuid.UUID `json:"user_id"`
	TokenType string    `json:"token_type"`
	jwt.RegisteredClaims
}

func (s *Service) createToken(userID uuid.UUID, duration time.Duration, tokenType string) (string, error) {
	now := time.Now()
	claims := TokenClaims{
		UserID:    userID,
		TokenType: tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

// argon2 params used both to create and to verify hashes.
const (
	argonSalt = "cartrune-salt"
	argonTime = 1
	argonMem  = 64 * 1024
	argonThr  = 4
	argonLen  = 32
)

func hashPassword(password string) string {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		panic("unable to generate password salt")
	}
	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMem, argonThr, argonLen)
	// Encode the raw binary hash as base64 so it is valid UTF-8 for the database.
	encoded := base64.RawStdEncoding.EncodeToString(hash)
	encodedSalt := base64.RawStdEncoding.EncodeToString(salt)
	return "$argon2id$v=19$m=65536,t=1,p=4$" + encodedSalt + "$" + encoded
}

func verifyPassword(password, storedHash string) bool {
	// Expected format: $argon2id$v=19$m=65536,t=1,p=4$<salt>$<base64 hash>
	parts := strings.Split(storedHash, "$")
	if len(parts) != 6 {
		return false
	}
	saltText := parts[4]
	encoded := parts[5]
	var salt []byte
	var err error
	if saltText == argonSalt {
		salt = []byte(saltText)
	} else {
		salt, err = base64.RawStdEncoding.DecodeString(saltText)
	}
	if err != nil {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(encoded)
	if err != nil {
		expected, err = base64.StdEncoding.DecodeString(encoded)
	}
	if err != nil {
		return false
	}

	got := argon2.IDKey([]byte(password), salt, argonTime, argonMem, argonThr, argonLen)
	return subtle.ConstantTimeCompare(got, expected) == 1
}
