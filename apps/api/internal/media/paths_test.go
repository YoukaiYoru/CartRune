package media

import (
	"net/url"
	"strings"
	"testing"

	"github.com/YoukaiYoru/api/internal/models"
	"github.com/google/uuid"
)

func TestSanitizeSSURLStripsCredentials(t *testing.T) {
	raw := "https://neoclone.screenscraper.fr/api2/mediaJeu.php?devid=u&devpassword=p&softname=CartRune&ssid=u&sspassword=p&systemeid=1&jeuid=1245&media=box-3D(eu)"
	clean := SanitizeSSURL(raw)

	for _, secret := range []string{"devid=u", "devpassword=p", "ssid=u", "sspassword=p"} {
		if strings.Contains(clean, secret) {
			t.Errorf("credential %q leaked into sanitized url: %s", secret, clean)
		}
	}
	if !strings.Contains(clean, "systemeid=1") || !strings.Contains(clean, "jeuid=1245") {
		t.Errorf("identifier params should be kept, got: %s", clean)
	}
}

func TestCoverPathUsesUUID(t *testing.T) {
	id := uuid.New()
	p := CoverPath(id)
	if p != "/api/v1/media/covers/"+id.String() {
		t.Errorf("unexpected cover path: %s", p)
	}
}

func TestGameMediaPath(t *testing.T) {
	p := GameMediaPath(1, 1245, "box-2D(eu)")
	if p != "/api/v1/media/games/1/1245?media=box-2D%28eu%29" {
		t.Errorf("unexpected game media path: %s", p)
	}
}

func TestPrimaryCoverPicksPrimaryThenBox(t *testing.T) {
	plain := models.Cover{ID: uuid.New(), Type: "fanart"}
	box := models.Cover{ID: uuid.New(), Type: "box-3D"}
	primary := models.Cover{ID: uuid.New(), Type: "box-2D", Primary: true}

	if got := PrimaryCover([]models.Cover{plain, box, primary}); got.ID != primary.ID {
		t.Errorf("expected primary cover, got %s", got.ID)
	}
	if got := PrimaryCover([]models.Cover{plain, box}); got.ID != box.ID {
		t.Errorf("expected first box cover, got %s", got.ID)
	}
	if got := PrimaryCover([]models.Cover{plain}); got.ID != plain.ID {
		t.Errorf("expected fallback to first cover, got %s", got.ID)
	}
	if got := PrimaryCover(nil); got != nil {
		t.Errorf("expected nil for empty covers, got %#v", got)
	}
}

func TestQueryEscapeRoundTrip(t *testing.T) {
	key := "box-2D(eu)"
	escaped := url.QueryEscape(key)
	t.Logf("escaped: %s", escaped)
}
