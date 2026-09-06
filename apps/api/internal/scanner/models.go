package scanner

type BarcodeRequest struct {
	Barcode string `json:"barcode"`
}

type TextRequest struct {
	Text         string `json:"text"`
	PlatformHint string `json:"platform_hint,omitempty"`
}

type MatchRequest struct {
	Embedding    []float64 `json:"embedding"`
	PlatformHint string    `json:"platform_hint,omitempty"`
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

type ScanResponse struct {
	Matches []MatchResult `json:"matches"`
	Method  string        `json:"method"`
}
