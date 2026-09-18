package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
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

func (s *Service) GetCurrentUser(userID uuid.UUID) (*models.User, error) {
	return s.repo.FindByID(userID)
}

func (s *Service) generateTokens(userID uuid.UUID) (*TokenResponse, error) {
	accessToken, err := s.createToken(userID, 24*time.Hour, "access")
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
		ExpiresIn:    86400,
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
