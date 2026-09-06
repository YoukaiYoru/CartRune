package users

type UpdateProfileRequest struct {
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
	Bio       string `json:"bio"`
}

type PublicProfileResponse struct {
	ID             string  `json:"id"`
	Username       string  `json:"username"`
	AvatarURL      string  `json:"avatar_url"`
	Bio            string  `json:"bio"`
	GamesCount     int     `json:"games_count"`
	CompletedCount int     `json:"completed_count"`
	HoursPlayed    float64 `json:"hours_played"`
	AvgRating      float64 `json:"avg_rating"`
}

type UserSummary struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
}
