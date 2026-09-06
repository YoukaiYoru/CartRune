package games

type GameResponse struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Developer   string `json:"developer"`
	Publisher   string `json:"publisher"`
	ReleaseDate string `json:"release_date,omitempty"`
	CoverURL    string `json:"cover_url,omitempty"`
}

type GameDetailResponse struct {
	GameResponse
	Platforms    []PlatformResponse `json:"platforms"`
	Releases     []ReleaseResponse  `json:"releases"`
	Covers       []CoverResponse    `json:"covers"`
	AvgRating    float64            `json:"avg_rating"`
	ReviewsCount int                `json:"reviews_count"`
}

type PlatformResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	Manufacturer string `json:"manufacturer"`
	Generation   int    `json:"generation"`
}

type ReleaseResponse struct {
	ID           string `json:"id"`
	GameID       string `json:"game_id"`
	PlatformID   string `json:"platform_id"`
	PlatformName string `json:"platform_name,omitempty"`
	Region       string `json:"region"`
	ReleaseDate  string `json:"release_date,omitempty"`
	Edition      string `json:"edition"`
	Physical     bool   `json:"physical"`
	Official     bool   `json:"official"`
}

type CoverResponse struct {
	ID       string `json:"id"`
	GameID   string `json:"game_id"`
	URL      string `json:"url"`
	Region   string `json:"region"`
	Language string `json:"language"`
	Type     string `json:"type"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Source   string `json:"source"`
	Primary  bool   `json:"primary"`
}

type SearchRequest struct {
	Query string `query:"q"`
	Page  int    `query:"page"`
	Limit int    `query:"limit"`
}

type PaginatedGames struct {
	Games []GameResponse `json:"games"`
	Total int64          `json:"total"`
	Page  int            `json:"page"`
	Limit int            `json:"limit"`
}
