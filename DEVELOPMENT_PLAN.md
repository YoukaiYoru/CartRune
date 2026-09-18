# CartRune — plan actualizado

Este plan parte del estado real del repositorio y de `game_library_architecture.md`. El backend modular ya cubre autenticación, catálogo, colecciones, progreso, reviews, social, media y matching vectorial; por eso el siguiente objetivo es cerrar la experiencia de producto y validar el vertical slice antes de ampliar infraestructura.

## Correcciones de dirección

- Adoptar una interfaz clara de biblioteca editorial: el tema oscuro café/verde existente no coincide con la identidad documentada.
- Tratar `Game` y `Release` como conceptos visibles en UI: la plataforma, región y edición deben aparecer antes de añadir a la colección.
- Hacer que el hogar sea un punto de reanudación: continuar jugando, añadidos recientes y escanear deben preceder al feed.
- Mantener Scanner como acción primaria, con fallback explícito Barcode → OCR → visual y resultados Top-3.
- No presentar ScreenScraper como la marca del producto: mostrarlo como fuente de catálogo solo en estados técnicos/importación.
- Diseñar el social feed como capa posterior, no como la navegación principal.

## Fases

### Fase 0 — base confiable

- Mantener la API propia como único contrato del móvil.
- Ejecutar typecheck y `go test ./...` en CI.
- Añadir fixtures/mocks de catálogo para que UI y scanner se puedan probar sin servicios externos.
- Normalizar paginación, estados de error y respuestas vacías en hooks.

### Fase 1 — vertical slice usable

- Home con CTA de escaneo, continuar jugando y recientemente añadidos.
- Scanner con tres métodos, permiso de cámara, captura, progreso y reintento.
- Resultados con score de coincidencia, plataforma/región/edición y acción “Añadir a mi colección”.
- Game detail con selección de release, estado de biblioteca y progreso.
- Library con filtros All / Playing / Completed / Backlog y búsqueda local.
- Validar en teléfono real con portadas PAL/NTSC, reflejos, plástico y mala iluminación.

### Fase 2 — retención individual

- Quick actions para cambiar status, progreso y horas sin entrar en varias pantallas.
- Review form con rating, spoiler y guardado optimista seguro.
- Perfil con estadísticas deduplicadas por colección pública/privada.
- Estados vacíos, offline, loading y retry consistentes.

### Fase 3 — comunidad

- Feed paginado de seguidos y actividad propia.
- Likes, comentarios y follow con estados idempotentes.
- Privacidad de librerías y moderación mínima.
- Notificaciones solo cuando exista una acción social real.

### Fase 4 — calidad y coste

- Medir Top-1/3/5, latencia, RAM y batería del matching.
- Cache local de catálogo y últimos resultados; no prometer offline total aún.
- Jobs de ingestión/embeddings separados solo cuando el volumen lo justifique.
- Observabilidad mínima: logs estructurados, errores de API, tiempos de scanner y disponibilidad de Qdrant.

## Orden inmediato de trabajo

1. Unificar tema, navegación, cards, estados y copy del móvil.
2. Corregir el flujo de release en detalle/resultados.
3. Crear mocks y pruebas de hooks/componentes.
4. Probar el vertical slice en dispositivo real.
5. Recién después optimizar MobileCLIP/Qdrant y ampliar social.

## Auditoría del estado actual — 2026-09-07

### Bloqueadores del arranque y conexión

- `expo start --offline` inicia correctamente, pero el móvil depende de `EXPO_PUBLIC_API_HOST` y actualmente apunta a una IP LAN fija. Si cambia la IP, el teléfono no puede llegar al API.
- El API, Qdrant y el servicio de embeddings son procesos separados. El `docker-compose.yml` solo levanta PostgreSQL y Qdrant; no existe un arranque único para API + embeddings.
- OCR/ML Kit es un módulo nativo. En Expo Go no se debe esperar que `expo-mlkit-ocr` funcione; el fallback remoto requiere que el servicio de embeddings esté levantado y sea accesible desde el teléfono.
- El matching visual no puede funcionar con catálogo/index vacío. Hay que exponer una health check útil y un estado de índice antes de mostrar “AI-powered live recognition”.

### Problemas del scanner

1. **Barcode solo busca en el catálogo local.** Si el juego no fue importado previamente, devuelve cero; no hay fallback controlado a proveedor externo → normalizador → confirmación → importación.
2. **OCR usa la primera línea encontrada.** En una portada esa línea puede ser el logo, publisher o texto legal. Debe enviar varias líneas y puntuar título, plataforma y región.
3. **Embedding se ejecuta en un servicio HTTP separado y sin contrato compartido.** El cliente no valida dimensión 512, el servidor tampoco la valida antes de consultar Qdrant y `platform_hint` se ignora en la búsqueda.
4. **Live scan es demasiado costoso para un MVP.** Captura cada 2.5 s, sube la imagen, calcula embedding, consulta Qdrant y repite. Primero debe funcionar captura única; live se habilita después con cooldown, cancelación y umbral de confianza.
5. **Los candidatos no representan suficientemente la release.** La UI debe mostrar plataforma, región, edición, físico/oficial y diferenciar “en catálogo” de “importar desde proveedor”.
6. **No hay observabilidad del fallo.** Cada intento necesita `scan_id`, método, latencia por etapa, estado de red y razón de descarte; nunca enviar la imagen ni credenciales a logs.

### Plan corregido del scanner

#### S0 — diagnóstico reproducible

- Añadir un comando de desarrollo que compruebe PostgreSQL, Qdrant, API y embeddings.
- Añadir `/health/ready` en API y `/health` en embeddings con versión del modelo e índice disponible.
- Permitir `EXPO_PUBLIC_API_HOST` configurable y documentar Android emulator, iOS simulator y teléfono físico.
- Crear fixtures locales para barcode, OCR y embedding; el usuario debe poder probar UI sin ScreenScraper ni Qdrant.

#### S1 — identificación confiable de una portada

```text
captura única
  → barcode local
  → OCR local/remoto con varias líneas
  → búsqueda en catálogo propio
  → si no hay match: backend consulta proveedor
  → normaliza y filtra
  → devuelve Top-3 releases
  → usuario confirma
```

- Barcode: normalizar dígitos, validar EAN-8/EAN-13/UPC-A/UPC-E y consultar `Release`, no solo `Game`.
- OCR: recortar la portada, corregir perspectiva si es posible, conservar top-N líneas y detectar señales de plataforma/región.
- Proveedor: el cliente nunca llama ScreenScraper; el API devuelve DTOs propios y una acción de importación temporal.
- Visual: usarlo como fallback de candidatos, no como afirmación definitiva; exigir dimensión, rango, normalización y score calibrado.

#### S2 — integración y confianza

- Mostrar “Alta / media / baja confianza” en vez de un porcentaje sin calibrar.
- No aceptar automáticamente un resultado visual ambiguo; exigir confirmación de edición.
- Indexar embeddings por `release_id` y filtrar por plataforma/región cuando exista hint.
- Probar con fotos reales: brillo, plástico, inclinación, PAL/NTSC, Greatest Hits, Platinum y varias distancias.

## Seguridad de ScreenScraper

Estado actual: el adapter y el media proxy mantienen las credenciales fuera de las respuestas normales, pero el diseño no está limpio todavía.

- Rotar inmediatamente las credenciales que aparecen en `.env` y en `apps/api/internal/screenscraper/testdata/*.json`.
- Reemplazar fixtures por tokens ficticios (`devid=test`, `devpassword=redacted`) y comprobarlo con un secret scan en CI.
- Mantener ScreenScraper solo en `apps/api/internal/screenscraper`; el móvil debe consumir `/games/search`, `/games/:id` y `/imports`, no rutas con el nombre del proveedor.
- Mantener `cover_url` como URL propia del media proxy. Nunca devolver el `media.url` original.
- Validar una lista cerrada de `media` keys, comprobar que el juego/release existe y añadir límites de tamaño/content-type al proxy.
- No revelar detalles internos de configuración en errores de producción; `ErrNoCredentials` debe convertirse en un mensaje genérico.
- Migrar de rate-limit en memoria por IP a un mecanismo compartido cuando haya más de una instancia.

## Criterios de aceptación del vertical slice

- Con solo PostgreSQL + API + fixtures, búsqueda manual y UI funcionan.
- Con Qdrant disponible e índice cargado, embedding devuelve Top-3 en menos de 3 s en una captura única.
- Con embeddings apagado, barcode/OCR/manual siguen funcionando y explican el fallback.
- Ninguna respuesta del API, log o fixture contiene `devpassword`, `sspassword` o la URL firmada de ScreenScraper.
- Una cuenta nueva tiene `My Collection`; seleccionar una release y añadirla es idempotente.
