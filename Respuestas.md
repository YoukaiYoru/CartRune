# Respuestas del proyecto CartRune

Documento de referencia de requisitos y decisiones iniciales. No contiene secretos, contraseñas ni claves privadas.

## Decisiones aplicadas

- App móvil Expo/EAS para Android/iOS.
- Identificación mediante foto de la carátula del videojuego.
- Backend Go con Gemini y ScreenScraper.
- Base de datos PostgreSQL externa en Supabase.
- Sin barcode, Qdrant, Ollama, MobileCLIP ni servicio separado de embeddings.
- Azure: resource group `cartrune-rg-chile`, región `chilecentral`.
- VM: `Standard_B2ats_v2`, disco de 30 GB.
- Dominio: `api-cartrune.duckdns.org`.
- Producción en la rama `master`.
- Puede existir una caída breve durante el despliegue.
