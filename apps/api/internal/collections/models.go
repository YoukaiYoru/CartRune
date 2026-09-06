package collections

type CreateLibraryRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPublic    bool   `json:"is_public"`
}

type UpdateLibraryRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPublic    *bool  `json:"is_public"`
}

type AddGameRequest struct {
	GameID    string `json:"game_id"`
	ReleaseID string `json:"release_id,omitempty"`
	Status    string `json:"status,omitempty"`
}

type LibraryResponse struct {
	ID          string `json:"id"`
	UserID      string `json:"user_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	IsPublic    bool   `json:"is_public"`
	GamesCount  int    `json:"games_count"`
	CreatedAt   string `json:"created_at"`
}

type LibraryDetailResponse struct {
	LibraryResponse
	Games []LibraryGameResponse `json:"games"`
}

type LibraryGameResponse struct {
	GameID      string  `json:"game_id"`
	ReleaseID   *string `json:"release_id,omitempty"`
	Title       string  `json:"title,omitempty"`
	Platform    string  `json:"platform,omitempty"`
	CoverURL    string  `json:"cover_url,omitempty"`
	Status      string  `json:"status"`
	Progress    int     `json:"progress"`
	HoursPlayed float64 `json:"hours_played"`
	AddedAt     string  `json:"added_at"`
	StartedAt   *string `json:"started_at,omitempty"`
	CompletedAt *string `json:"completed_at,omitempty"`
}
