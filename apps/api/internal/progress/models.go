package progress

type UpdateProgressRequest struct {
	Status      string   `json:"status"`
	Progress    *int     `json:"progress"`
	HoursPlayed *float64 `json:"hours_played"`
	StartedAt   *string  `json:"started_at,omitempty"`
	CompletedAt *string  `json:"completed_at,omitempty"`
}

type ProgressResponse struct {
	GameID      string  `json:"game_id"`
	Status      string  `json:"status"`
	Progress    int     `json:"progress"`
	HoursPlayed float64 `json:"hours_played"`
	StartedAt   *string `json:"started_at,omitempty"`
	CompletedAt *string `json:"completed_at,omitempty"`
}
