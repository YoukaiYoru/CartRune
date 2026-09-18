package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Username     string         `gorm:"uniqueIndex;size:50;not null" json:"username"`
	Email        string         `gorm:"uniqueIndex;size:255;not null" json:"email"`
	PasswordHash string         `gorm:"size:255;not null" json:"-"`
	AvatarURL    string         `gorm:"size:500" json:"avatar_url"`
	Bio          string         `gorm:"size:500" json:"bio"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type RefreshToken struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey" json:"-"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"-"`
	TokenHash string     `gorm:"size:64;uniqueIndex;not null" json:"-"`
	ExpiresAt time.Time  `gorm:"index;not null" json:"-"`
	RevokedAt *time.Time `gorm:"index" json:"-"`
	CreatedAt time.Time  `json:"-"`
}

type Game struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Title       string         `gorm:"size:255;not null" json:"title"`
	Slug        string         `gorm:"uniqueIndex;size:255;not null" json:"slug"`
	Description string         `gorm:"type:text" json:"description"`
	Developer   string         `gorm:"size:255" json:"developer"`
	Publisher   string         `gorm:"size:255" json:"publisher"`
	ReleaseDate *time.Time     `json:"release_date"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Platforms []Platform `gorm:"many2many:game_platforms;" json:"platforms,omitempty"`
	Releases  []Release  `gorm:"foreignKey:GameID" json:"releases,omitempty"`
	Covers    []Cover    `gorm:"foreignKey:GameID" json:"covers,omitempty"`
}

type Platform struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name         string    `gorm:"size:100;not null" json:"name"`
	Slug         string    `gorm:"uniqueIndex;size:100;not null" json:"slug"`
	Manufacturer string    `gorm:"size:100" json:"manufacturer"`
	Generation   int       `json:"generation"`
}

type GamePlatform struct {
	GameID     uuid.UUID `gorm:"type:uuid;primaryKey"`
	PlatformID uuid.UUID `gorm:"type:uuid;primaryKey"`
}

type Release struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	GameID      uuid.UUID  `gorm:"type:uuid;not null;index" json:"game_id"`
	PlatformID  uuid.UUID  `gorm:"type:uuid;not null;index" json:"platform_id"`
	Region      string     `gorm:"size:50" json:"region"`
	ReleaseDate *time.Time `json:"release_date"`
	Edition     string     `gorm:"size:100" json:"edition"`
	Barcode     string     `gorm:"size:50;index" json:"barcode,omitempty"`
	Physical    bool       `gorm:"default:true" json:"physical"`
	Official    bool       `gorm:"default:true" json:"official"`
	CreatedAt   time.Time  `json:"created_at"`

	Game     Game     `gorm:"foreignKey:GameID" json:"game,omitempty"`
	Platform Platform `gorm:"foreignKey:PlatformID" json:"platform,omitempty"`
}

type Cover struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	GameID    uuid.UUID `gorm:"type:uuid;not null;index" json:"game_id"`
	ReleaseID uuid.UUID `gorm:"type:uuid;index" json:"release_id"`
	URL       string    `gorm:"size:500;not null" json:"url"`
	Region    string    `gorm:"size:50" json:"region"`
	Language  string    `gorm:"size:10" json:"language"`
	Type      string    `gorm:"size:50" json:"type"`
	Width     int       `json:"width"`
	Height    int       `json:"height"`
	Source    string    `gorm:"size:50" json:"source"`
	Primary   bool      `gorm:"default:false" json:"primary"`
}

type Library struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Name        string         `gorm:"size:100;not null" json:"name"`
	Description string         `gorm:"size:500" json:"description"`
	IsPublic    bool           `gorm:"default:true" json:"is_public"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	User  User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Games []LibraryGame `gorm:"foreignKey:LibraryID" json:"games,omitempty"`
}

type LibraryGame struct {
	LibraryID   uuid.UUID  `gorm:"type:uuid;primaryKey" json:"library_id"`
	GameID      uuid.UUID  `gorm:"type:uuid;primaryKey;not null;index" json:"game_id"`
	ReleaseID   *uuid.UUID `gorm:"type:uuid" json:"release_id"`
	Status      string     `gorm:"size:50;default:'backlog'" json:"status"`
	Progress    int        `gorm:"default:0" json:"progress"`
	HoursPlayed float64    `gorm:"default:0" json:"hours_played"`
	AddedAt     time.Time  `json:"added_at"`
	StartedAt   *time.Time `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at"`

	Game    Game     `gorm:"foreignKey:GameID" json:"game,omitempty"`
	Release *Release `gorm:"foreignKey:ReleaseID" json:"release,omitempty"`
}

type Review struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	GameID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"game_id"`
	Rating    int            `gorm:"not null" json:"rating"`
	Title     string         `gorm:"size:255" json:"title"`
	Content   string         `gorm:"type:text" json:"content"`
	Spoiler   bool           `gorm:"default:false" json:"spoiler"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Game Game `gorm:"foreignKey:GameID" json:"game,omitempty"`
}

type ReviewLike struct {
	ReviewID  uuid.UUID `gorm:"type:uuid;primaryKey" json:"review_id"`
	UserID    uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Comment struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ReviewID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"review_id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Content   string         `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type Follow struct {
	FollowerID  uuid.UUID `gorm:"type:uuid;primaryKey" json:"follower_id"`
	FollowingID uuid.UUID `gorm:"type:uuid;primaryKey" json:"following_id"`
	CreatedAt   time.Time `json:"created_at"`

	Follower  User `gorm:"foreignKey:FollowerID" json:"follower,omitempty"`
	Following User `gorm:"foreignKey:FollowingID" json:"following,omitempty"`
}

type Activity struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Type      string    `gorm:"size:50;not null" json:"type"`
	EntityID  uuid.UUID `gorm:"type:uuid" json:"entity_id"`
	CreatedAt time.Time `json:"created_at"`

	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type ScanMetric struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID     uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	Method     string    `gorm:"size:32;index;not null" json:"method"`
	Outcome    string    `gorm:"size:32;index;not null" json:"outcome"`
	Fallback   string    `gorm:"size:64" json:"fallback"`
	Confidence *float64  `json:"confidence,omitempty"`
	DurationMS int64     `json:"duration_ms"`
	ErrorCode  string    `gorm:"size:64" json:"error_code,omitempty"`
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
}

type DependencyMetric struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Service    string    `gorm:"size:32;index;not null" json:"service"`
	Operation  string    `gorm:"size:64;index;not null" json:"operation"`
	Success    bool      `gorm:"index;not null" json:"success"`
	Status     int       `json:"status"`
	DurationMS int64     `json:"duration_ms"`
	ErrorCode  string    `gorm:"size:64" json:"error_code,omitempty"`
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
}

type RateLimitBucket struct {
	Key             string    `gorm:"size:128;primaryKey" json:"-"`
	WindowStartedAt time.Time `gorm:"not null" json:"-"`
	Count           int       `gorm:"not null" json:"-"`
	UpdatedAt       time.Time `json:"-"`
}
