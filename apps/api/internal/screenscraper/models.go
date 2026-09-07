package screenscraper

// SearchRequest is the payload of POST /screenscraper/search.
type SearchRequest struct {
	Query     string `json:"query"`
	SystemeID int    `json:"systemeid,omitempty"`
	Region    string `json:"region,omitempty"`
	Language  string `json:"language,omitempty"`
}

// SearchItem is a normalized candidate returned by the search endpoint.
type SearchItem struct {
	GameID      int    `json:"game_id"`
	Title       string `json:"title"`
	SystemName  string `json:"system,omitempty"`
	SystemID    int    `json:"system_id,omitempty"`
	Region      string `json:"region,omitempty"`
	ReleaseDate string `json:"release_date,omitempty"`
	CoverURL    string `json:"cover_url,omitempty"`
	Synopsis    string `json:"synopsis,omitempty"`
	Note        int    `json:"note,omitempty"`
	Official    bool   `json:"official"`
	FilteredOut string `json:"filtered_out,omitempty"`
}

// CoverData represents one cover/media found for a game.
type CoverData struct {
	Key    string `json:"key"`
	URL    string `json:"url"`
	Kind   string `json:"kind,omitempty"`
	Region string `json:"region,omitempty"`
}

// MediaData represents any piece of media belonging to a game: images (box
// front/3D, screenshots, logos, fanart, ...) or videos. Kind is a coarse
// classification ("2d", "3d", "screenshot", "logo", "video", ...) so clients
// can render or filter without knowing every ScreenScraper token.
type MediaData struct {
	Key    string `json:"key"`
	URL    string `json:"url"`
	Kind   string `json:"kind,omitempty"`
	Region string `json:"region,omitempty"`
}

// DetailResponse is the normalized output of GET /screenscraper/games/:id.
type DetailResponse struct {
	GameID      int         `json:"game_id"`
	Title       string      `json:"title"`
	Description string      `json:"description"`
	Developer   string      `json:"developer"`
	Publisher   string      `json:"publisher"`
	ReleaseDate string      `json:"release_date,omitempty"`
	Players     int         `json:"players,omitempty"`
	Note        int         `json:"note,omitempty"`
	System      string      `json:"system,omitempty"`
	SystemID    int         `json:"system_id,omitempty"`
	Official    bool        `json:"official"`
	FilteredOut string      `json:"filtered_out,omitempty"`
	CoverURL    string      `json:"cover_url,omitempty"`
	Covers      []CoverData `json:"covers,omitempty"`
	Media       []MediaData `json:"media,omitempty"`
}

// ImportResponse is the output of POST /screenscraper/games/:id/import.
type ImportResponse struct {
	GameID  string `json:"game_id"`
	Title   string `json:"title"`
	Created bool   `json:"created"`
}
