package screenscraper

// The ScreenScraper WebAPI v2 returns a JSON envelope of the form
//
//	{
//	  "header":  { "success":"true", "error":"", ... },
//	  "response": { "serveurs":{...}, "ssuser":{...}, "jeux":[ ... ] | "jeu":{ ... } }
//	}
//
// Unlike the flattened shape described in the older webapi2.php docs, the live
// API wraps everything under "response", silently ignores unknown fields and
// encodes most scalar values as strings (numbers, booleans). The types below
// follow that real payload.

// APIResponse is the top-level envelope common to all ScreenScraper endpoints.
type APIResponse struct {
	Header   Header   `json:"header"`
	Response Response `json:"response"`
}

// Header carries the API status for the request.
type Header struct {
	APIversion       string `json:"APIversion"`
	Date             string `json:"dateTime"`
	CommandRequested string `json:"commandRequested"`
	Success          string `json:"success"`
	Error            string `json:"error"`
}

// Response holds the payload of a request: "jeux" (search) or "jeu" (detail).
type Response struct {
	Serveurs map[string]interface{} `json:"serveurs"`
	SSUser   map[string]interface{} `json:"ssuser"`
	Jeux     []*GameInfo            `json:"jeux"`
	Jeu      *GameInfo              `json:"jeu"`
}

// GameInfo is a game object returned by jeuRecherche.php or jeuInfos.php.
// jeuInfos.php is richer: it also includes "dates" and "roms".
type GameInfo struct {
	ID          string    `json:"id"`
	NotGame     string    `json:"notgame"`
	CloneOf     *string   `json:"cloneof"`
	Noms        []Nome    `json:"noms"`
	Systeme     System    `json:"systeme"`
	Editeur     TextID    `json:"editeur"`
	Developpeur TextID    `json:"developpeur"`
	Joueurs     *TextOnly `json:"joueurs"`
	Note        *TextOnly `json:"note"`
	TopStaff    string    `json:"topstaff"`
	Rotation    string    `json:"rotation"`

	Synopsis []Synopsis  `json:"synopsis"`
	Dates    []Nome      `json:"dates"`
	Medias   []MediaItem `json:"medias"`
	Roms     []*Rom      `json:"roms"`
}

// Nome is an entry of the "noms" / "dates" blocks: a { region, text } pair.
type Nome struct {
	Region string `json:"region"`
	Text   string `json:"text"`
}

// TextID is a { id, text } pair used for e.g. system/eiditeur/developpeur.
type TextID struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

// TextOnly is a { text } object used for "joueurs" and "note".
type TextOnly struct {
	Text string `json:"text"`
}

// Synopsis is an entry of the "synopsis" block: a { langue, text } pair.
type Synopsis struct {
	Langue string `json:"langue"`
	Text   string `json:"text"`
}

// MediaItem is one entry of the "medias" array. The "type" discriminates
// (box-2D, box-3D, box-texture, support-2D, fanart, wheel, ...).
type MediaItem struct {
	Type   string `json:"type"`
	Parent string `json:"parent"`
	URL    string `json:"url"`
	Region string `json:"region"`
}

// Rom describes a known ROM associated with the game. Its flag fields are
// strings ("0"/"1") and drive the official-content filter (see architecture
// #16). Only present in jeuInfos.php responses.
type Rom struct {
	ID           string `json:"id"`
	NumSupport   string `json:"romnumsupport"`
	TotalSupport string `json:"romtotalsupport"`
	FileName     string `json:"romfilename"`
	Size         string `json:"romsize"`
	CRC          string `json:"romcrc"`
	MD5          string `json:"rommd5"`
	SHA1         string `json:"romsha1"`
	Serial       string `json:"romserial"`
	Regions      string `json:"romregions"`
	Langues      string `json:"romlangues"`
	Beta         string `json:"beta"`
	Demo         string `json:"demo"`
	Proto        string `json:"proto"`
	Trad         string `json:"trad"`
	Hack         string `json:"hack"`
	UNL          string `json:"unl"`
	Alt          string `json:"alt"`
	Best         string `json:"best"`
	CloneOf      string `json:"romcloneof"`
}

// System is the platform/system a game belongs to.
type System struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}
