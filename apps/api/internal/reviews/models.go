package reviews

type CreateReviewRequest struct {
	GameID  string `json:"game_id"`
	Rating  int    `json:"rating"`
	Title   string `json:"title"`
	Content string `json:"content"`
	Spoiler bool   `json:"spoiler"`
}

type UpdateReviewRequest struct {
	Rating  *int   `json:"rating"`
	Title   string `json:"title"`
	Content string `json:"content"`
	Spoiler *bool  `json:"spoiler"`
}

type ReviewResponse struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	GameID     string `json:"game_id"`
	Rating     int    `json:"rating"`
	Title      string `json:"title"`
	Content    string `json:"content"`
	Spoiler    bool   `json:"spoiler"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
	Username   string `json:"username,omitempty"`
	AvatarURL  string `json:"avatar_url,omitempty"`
	LikesCount int    `json:"likes_count"`
}

type CommentRequest struct {
	Content string `json:"content"`
}

type CommentResponse struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	ReviewID  string `json:"review_id"`
	Content   string `json:"content"`
	CreatedAt string `json:"created_at"`
	Username  string `json:"username,omitempty"`
	AvatarURL string `json:"avatar_url,omitempty"`
}
