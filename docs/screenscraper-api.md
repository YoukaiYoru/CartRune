# ScreenScraper WebAPI v2 — Referencia (ES)

Notas de integración de ScreenScraper en la API de CartRune. Documento de
referencia sobre la API v2; para la implementación concreta ver
`game_library_architecture.md` y el código en `apps/api/internal/screenscraper`.

---

## 1. Consideraciones generales

- Base URL: `https://api.screenscraper.fr/api2/`
- Requiere credenciales de desarrollador (`devid`, `devpassword`) en **todas**
  las llamadas. Opcionalmente se añade una cuenta de usuario (`ssid`,
  `sspassword`) para subir cuota.
- Los ejemplos usan `devid=xxx&devpassword=yyy` por claridad; en CartRune las
  credenciales se cargan desde `.env` (`SS_DEVID/SS_DEVPASSWORD`, etc.) y
  **nunca** se exponen al frontend (ver §8 "Media proxy").
- `softname` identifica la aplicación (CartRune).
- `output=json` para respuestas JSON.

### Configuración runtime

La API solo consulta ScreenScraper cuando recibe una búsqueda autenticada en
`POST /api/v1/catalog/search` o una consulta de detalle/importación. Configura
estas variables en `apps/api/.env` (nunca en el frontend):

```dotenv
SS_DEVID=
SS_DEVPASSWORD=
SS_SOFTNAME=CartRune
SS_USERID=                 # opcional; mejora la cuota si está autorizado
SS_USERPASSWORD=           # opcional
SS_BASE_URL=https://api.screenscraper.fr/api2/
SS_TIMEOUT=20s
SS_MIN_DELAY=1500ms
SS_MAX_RETRY=2
SS_CACHE_TTL=2m
```

Las búsquedas repetidas se sirven desde una caché en memoria durante
`SS_CACHE_TTL`; los errores transitorios (`408`, `429` y `5xx`) usan reintentos
limitados y backoff. El cliente respeta la cancelación del request para no
dejar goroutines o esperas bloqueadas.
- Formato real (confirmado con llamadas en vivo):
  - Top-level: `{ "header": {...}, "response": {...} }`.
  - `noms`, `synopsis`, `dates`, `medias`, `roms` son **arrays de objetos**.
  - Casi todos los escalares son **strings** ("0"/"1", ids numéricos, fechas).
  - `systeme` = `{ id, text }`.
  - `jeuRecherche.php` **no** incluye `roms` (el filtro de contenido oficial
    solo es fiable en `jeuInfos.php`).

## 2. Errores (códigos de estado HTTP)

La API v2 devuelve errores con `{ "error": "..." }` y códigos como:

- `401` — credenciales inválidas / no autorizado.
- `403` — permiso denegado (cuenta sin acceso a ese recurso).
- `404` — no encontrado (juego/sistema/medio no existe).
- `429` — cuota superada / demasiadas peticiones.

CartRune mapea esos fallos a errores propios (`ErrNoCredentials`,
`ErrRateLimited`, `ErrNotFound`, `ErrUnexpectedStatus`, `ErrDecode`) y a
respuestas HTTP locales (503/502/404/400).

## 3. Parámetros comunes

| Parámetro  | Descripción |
|---|---|
| `devid` / `devpassword` | Credenciales de desarrollador (obligatorias) |
| `softname` | Nombre del software (obligatorio) |
| `output` | `xml` (por defecto) o `json` |
| `ssid` / `sspassword` | Cuenta de usuario opcional (mayor cuota) |
| `systemeid` | Id del sistema (ver `systemesListe.php`) |
| `jeuid` | Id del juego |
| `media` | Tipo de medio, ej. `box-2D`, `box-3D`, `box-2D(eu)` |
| `langue` | Idioma de la sinopsis (ej. `en`, `es`, `fr`) |
| `region` | Región preferida (ej. `eu`, `us`, `jp`, `wor`, `ss`) |
| `sha1` / `md5` / `crc` | Identificación por hash de rom |
| `romnom` / `recherche` | Búsqueda por nombre de rom / nombre del juego |

## 4. Endpoint principal: `jeuInfos.php`

Devuelve la ficha completa de un juego: nombres por región, sinopsis, fechas,
sistema, empresas, notas, medias (carátulas) y **roms** (con flags utilizados
para el filtro de contenido oficial).

### 4.1 Parámetros de entrada

- Búsqueda global del juego: `romnom` u otro identificador junto a
  `romtype=rom`.
- Búsqueda por id del juego: `gameid=N` (usado por CartRune para
  `GET /screenscraper/games/:id`).

### 4.2 Estructura de respuesta (JSON real de la v2)

```
response
 ├── serveurs: {...}
 ├── ssuser: {...}
 ├── jeu:
 │    ├── id
 │    ├── notgame
 │    ├── noms:    [ { region, text } ]
 │    ├── systeme: { id, text }
 │    ├── editeur / developpeur: { id, text }
 │    ├── joueurs: { text }
 │    ├── note:    { text }
 │    ├── synopsis:[ { langue, text } ]
 │    ├── dates:   [ { region, text } ]
 │    ├── medias:  [ { type, parent, url, region, crc, md5, sha1, size, format } ]
 │    └── roms:    [ { id, romfilename, romsize, romcrc, rommd5, romsha1, romregions, ... flags } ]
```

- Tipos de `medias` frecuentes: `box-2D`, `box-3D`, `box-texture`,
  `box-2D-back`, `support-2D`, `support-texture`, `sstitle`, `ss`, `ffix`,
  `wheel`, `screenmarquee`, `fanart`, `logo`, `video`, `manuel`, `bezel-*`,
  `mixrbv*`, ...
- Cada `media.url` apunta a `mediaJeu.php` **con las credenciales incrustadas**
  (`devid`, `devpassword`, `ssid`, `sspassword`). Por eso CartRune sirve las
  imágenes por su proxy de medios (ver §8) y persiste las URLs **sanitizadas**.

## 5. Endpoint relacionado: `jeuRecherche.php`

Búsqueda por nombre; devuelve hasta 30 juegos ordenados por probabilidad.

### 5.1 Parámetros

- `recherche=<nombre>`
- Opcional: `systemeid`, `langue`, `region`

### 5.2 Respuesta

Misma envoltura que en §4, con `response.jeux` (array). **No** incluye `roms`
ni las listas completas de `dates`/`medias` (los `medias` se resumen):
el filtro `official` solo es fiable en `jeuInfos.php`.

## 6. Otros endpoints de interés (referencia)

- `ssinfraInfos.php` — estado infraestructura / servidor.
- `ssuserInfos.php` — info y cuotas del usuario.
- `userlevelsListe.php` — niveles de usuario.
- `nbJoueursListe.php` / `supportTypesListe.php` / `romTypesListe.php` / `regionsListe.php` / `languesListe.php` / `genresListe.php` / `famillesListe.php` / `classificationsListe.php` — listas de referencia.
- `mediasSystemeListe.php` / `mediasJeuListe.php` / `infosJeuListe.php` / `infosRomListe.php` — listas de medios/infos disponibles.
- `systemesListe.php` — lista de sistemas (necesaria para resolver `systemeid`).
- `mediaJeu.php` / `mediaVideoJeu.php` / `mediaManuelJeu.php` — descarga directa de medios.
- `botNote.php` / `botProposition.php` — automatización de notas/propuestas (no necesario).

---

## 7. Recomendaciones para CartRune

1. **No exponer ScreenScraper al cliente**: el backend debe consumirlo vía el
   `screenscraper` adapter y normalizar a entidades propias (`Game`, `Release`,
   `Platform`, `Cover`). Esto permite cambiar de proveedor (ej. IGDB) sin tocar
   la app.
2. **Usar `jeuRecherche`** tras identificar el nombre de la portada por cámara;
   usar el `game_id` de la respuesta para pedir la carátula con `jeuInfos`.
3. **Filtrar contenido no oficial** usando los flags de la rom (`hack`, `unl`,
   `demo`, `beta`, `trad`, `alt`) y `notgame`.
4. Para la **carátula física**, dar prioridad a `box-3D` → `box-2D` →
   `box-texture` → `support-2D` → `support-texture` → `fanart`.
5. **Gestionar cuotas** leyendo `ssuser` en cada respuesta y limitando la tasa.
6. Resolver ids (sistema, región, idioma, género) mediante los endpoints
   `*Liste.php` y cachearlos.

---

## 8. Media proxy (seguridad selectiva en la API de CartRune)

ScreenScraper **no ofrece** un mecanismo nativo para servir medios sin exponer
credenciales en la URL: todos los endpoints de `media*Jeu.php` exigen
`devid`/`devpassword` (y `ssid`/`sspassword`) como query params. Exponer el
`cover_url` crudo al frontend mobile filtraría tus credenciales (ver advisory
RomM `GHSA-3rmg-j6mh-5m76`). Por ello CartRune sirve las imágenes a través de
su propio proxy:

### Rutas (públicas, con rate-limit por IP)

| Ruta | Descripción |
|---|---|
| `GET /api/v1/media/covers/:id` | Sirve una carátula **persistida** (Cover por UUID local) |
| `GET /api/v1/media/games/:systemeid/:jeuid?media=<token>` | Sirve un medio ScreenScraper **al vuelo** (ej. `media=box-3D(eu)`) |

Las rutas son **públicas** (sin JWT), de modo que el componente `<Image>` del
frontend puede cargarlas directamente sin mandar credenciales. Eso **no**
expone credenciales de ScreenScraper: la URL pública es interna y nunca
contiene `devid`/`devpassword`.

Para proteger la cuota de ScreenScraper del uso indebido, el proxy aplica un
**rate-limit por IP** (`MEDIA_RATE_LIMIT`, por defecto 60 peticiones por
`MEDIA_RATE_WINDOW`, 1 minuto). Las imágenes se transmiten directamente y no se
guardan en disco ni en la base de datos.

### Reglas

- Las URLs devueltas como `cover_url` típicamente apuntan al proxy:
  `/api/v1/media/covers/<uuid>` (persistida) o
  `/api/v1/media/games/<id>/<id>?media=...` (al vuelo). **Nunca** contienen
  credenciales.
- Al persistir, las URLs se **sanitizan** (se eliminan `devid`, `devpassword`,
  `ssid`, `sspassword`, `softname`, `output`); el proxy las re-añade solo
  server-side al descargar.
- Las imágenes se descargan en memoria únicamente durante la petición y se
  transmiten al cliente; no se guardan en disco ni en la base de datos.
- Un arranque del servidor limpia cualquier URL con credenciales que pudiera
  quedar persistida de versiones anteriores.

### Frontend

No hace falta ningún header especial: las rutas `/api/v1/media/*` son públicas
y el `<Image>` carga `cover_url` directamente. El rate-limit por IP protege
la cuota de ScreenScraper.
