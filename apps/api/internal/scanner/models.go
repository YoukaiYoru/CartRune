package scanner

type TextRequest struct {
	Text         string `json:"text"`
	PlatformHint string `json:"platform_hint,omitempty"`
}

type MatchResult struct {
	GameID     string  `json:"game_id"`
	ReleaseID  string  `json:"release_id"`
	Title      string  `json:"title"`
	Platform   string  `json:"platform"`
	Region     string  `json:"region"`
	CoverURL   string  `json:"cover_url"`
	Similarity float64 `json:"similarity"`
}

type CoverAnalysis struct {
	Title     string `json:"title"`
	Console   string `json:"console"`
	Region    string `json:"region"`
	Edition   string `json:"edition"`
	Publisher string `json:"publisher"`
	Query     string `json:"query"`
}

type ScanResponse struct {
	Matches     []MatchResult `json:"matches"`
	Method      string        `json:"method"`
	MatchSource string        `json:"match_source"`
	Fallback    string        `json:"fallback,omitempty"`
}
