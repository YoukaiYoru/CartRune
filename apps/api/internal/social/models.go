package social

type FollowResponse struct {
	FollowerID  string `json:"follower_id"`
	FollowingID string `json:"following_id"`
	Username    string `json:"username,omitempty"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}

type FeedItem struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	AvatarURL string `json:"avatar_url"`
	Type      string `json:"type"`
	EntityID  string `json:"entity_id"`
	Title     string `json:"title,omitempty"`
	CreatedAt string `json:"created_at"`
}
