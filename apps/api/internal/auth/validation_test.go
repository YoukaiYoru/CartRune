package auth

import "testing"

func TestNormalizeRegisterRequest(t *testing.T) {
	tests := []struct {
		name    string
		request RegisterRequest
		valid   bool
	}{
		{
			name:    "normalizes valid input",
			request: RegisterRequest{Username: " player_one ", Email: " USER@Example.COM ", Password: "secure-password1"},
			valid:   true,
		},
		{
			name:    "rejects weak password",
			request: RegisterRequest{Username: "player_one", Email: "user@example.com", Password: "short1"},
		},
		{
			name:    "rejects unsafe username",
			request: RegisterRequest{Username: "player one", Email: "user@example.com", Password: "secure-password1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeRegisterRequest(tt.request)
			if (err == nil) != tt.valid {
				t.Fatalf("valid=%v, error=%v", tt.valid, err)
			}
			if tt.valid && (got.Email != "user@example.com" || got.Username != "player_one") {
				t.Fatalf("request was not normalized: %+v", got)
			}
		})
	}
}
