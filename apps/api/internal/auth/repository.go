package auth

import (
	"time"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

func (r *Repository) CreateWithDefaultLibrary(user *models.User) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		return tx.Create(&models.Library{
			ID:          uuid.New(),
			UserID:      user.ID,
			Name:        "My Collection",
			Description: "Games I own and want to play.",
			IsPublic:    true,
		}).Error
	})
}

func (r *Repository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	err := r.db.Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) FindByUsername(username string) (*models.User, error) {
	var user models.User
	err := r.db.Where("username = ?", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) FindByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.First(&user, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *Repository) CreateRefreshToken(token *models.RefreshToken) error {
	return r.db.Create(token).Error
}

func (r *Repository) ConsumeRefreshToken(hash string) (uuid.UUID, error) {
	var token models.RefreshToken
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("token_hash = ? AND revoked_at IS NULL", hash).First(&token).Error; err != nil {
			return err
		}
		if time.Now().After(token.ExpiresAt) {
			return gorm.ErrInvalidData
		}
		now := time.Now()
		return tx.Model(&token).Update("revoked_at", &now).Error
	})
	return token.UserID, err
}

func (r *Repository) RevokeRefreshToken(hash string) error {
	now := time.Now()
	return r.db.Model(&models.RefreshToken{}).
		Where("token_hash = ? AND revoked_at IS NULL", hash).
		Update("revoked_at", &now).Error
}

func (r *Repository) CreatePasswordResetToken(token *models.PasswordResetToken) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&models.PasswordResetToken{}).
			Where("user_id = ? AND used_at IS NULL AND expires_at > ?", token.UserID, now).
			Update("used_at", &now).Error; err != nil {
			return err
		}
		return tx.Create(token).Error
	})
}

func (r *Repository) ResetPassword(tokenHash, passwordHash string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var token models.PasswordResetToken
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("token_hash = ? AND used_at IS NULL AND expires_at > ?", tokenHash, time.Now()).
			First(&token).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.User{}).Where("id = ?", token.UserID).Update("password_hash", passwordHash).Error; err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&token).Update("used_at", &now).Error; err != nil {
			return err
		}
		return tx.Model(&models.RefreshToken{}).
			Where("user_id = ? AND revoked_at IS NULL", token.UserID).
			Update("revoked_at", &now).Error
	})
}
