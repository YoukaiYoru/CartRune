package screenscraper

import (
	"encoding/json"
	"os"
	"testing"
)

func TestParseSearch(t *testing.T) {
	data, err := os.ReadFile("testdata/jeuRecherche.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var res APIResponse
	if err := json.Unmarshal(data, &res); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	if len(res.Response.Jeux) == 0 {
		t.Fatal("expected at least one game")
	}
	g := res.Response.Jeux[0]
	if g.IDInt() == 0 {
		t.Errorf("expected numeric id, got %q", g.ID)
	}
	if g.Title("eu") == "" {
		t.Errorf("expected a title, got %q", g.Title("eu"))
	}
	if g.Systeme.Text == "" {
		t.Errorf("expected system text, got %q", g.Systeme.Text)
	}
	if g.CoverURL("eu") == "" {
		t.Errorf("expected a cover url, got %q", g.CoverURL("eu"))
	}
	// jeuRecherche does not include roms, so the game must be treated official.
	if ok, reason := g.OfficialContent(); !ok {
		t.Errorf("expected official=true (no roms in search), got false: %s", reason)
	}
}

func TestParseDetailAndFilter(t *testing.T) {
	data, err := os.ReadFile("testdata/jeuInfos.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var res APIResponse
	if err := json.Unmarshal(data, &res); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	if res.Response.Jeu == nil {
		t.Fatal("expected a single game")
	}
	g := res.Response.Jeu

	if g.IDInt() == 0 {
		t.Errorf("expected numeric id, got %q", g.ID)
	}
	if g.Title("eu") == "" {
		t.Errorf("expected title, got %q", g.Title("eu"))
	}
	if g.Systeme.Text == "" {
		t.Errorf("expected system, got %q", g.Systeme.Text)
	}
	if got := g.PlayerCount(); got < 1 {
		t.Errorf("expected a player count, got %d", got)
	}
	if g.GetSynopsis("es") == "" && g.GetSynopsis("") == "" {
		t.Error("expected a synopsis")
	}
	if len(g.AllCovers()) == 0 {
		t.Error("expected at least one cover")
	}
	// This fixture is a Taiwan pirate/homebrew ROM (unl=1), so it must be filtered.
	ok, reason := g.OfficialContent()
	if ok {
		t.Errorf("expected unofficial ROM to be filtered, reason=%q", reason)
	}
	if reason == "" {
		t.Errorf("expected a filter reason, got %q", reason)
	}
}
