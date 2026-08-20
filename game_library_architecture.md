# Game Library Scanner — Arquitectura, Stack y Plan de Desarrollo

## 1. Visión del proyecto

Aplicación móvil inspirada conceptualmente en Goodreads, pero orientada a **videojuegos físicos**.

Objetivos principales:

- Escanear la portada física de un videojuego usando la cámara.
- Detectar videojuegos mediante barcode, OCR y visión por computadora.
- Obtener candidatos desde un catálogo propio.
- Usar ScreenScraper como fuente de datos inicial, pero **no exponer ScreenScraper directamente al cliente**.
- Filtrar juegos originales/oficiales y publicados, evitando mods, hacks, demos, betas, versiones no oficiales, etc.
- Permitir buscar videojuegos manualmente.
- Guardar juegos físicos en bibliotecas propias.
- Registrar progreso, horas, estado de juego y finalización.
- Crear reviews y ratings.
- Compartir actividad con una comunidad.
- Seguir usuarios, dar likes y comentar.
- Mantener el sistema inicialmente gratuito o de muy bajo costo.
- Diseñar la arquitectura para poder escalar posteriormente.

---

# 2. Decisión arquitectónica principal

La aplicación debería ser:

> **Mobile-first + local-first en la medida de lo posible + API propia + catálogo normalizado + búsqueda vectorial.**

La IA móvil no debería intentar resolver directamente:

> "Esta imagen es Resident Evil 4."

En su lugar:

```text
Portada
   ↓
Vision Encoder
   ↓
Embedding
   ↓
Búsqueda por similitud
   ↓
Top-N candidatos
   ↓
Catálogo propio
```

Esto permite:

- Reducir el tamaño y complejidad del modelo.
- Evitar inferencia pesada en servidor.
- Mantener el backend barato.
- Mostrar varias opciones cuando hay ambigüedad.
- Cambiar de modelo de IA sin cambiar todo el sistema.

---

# 3. Arquitectura general

```text
                         ┌─────────────────────┐
                         │    React Native     │
                         │       + Expo        │
                         └──────────┬──────────┘
                                    │
                         Cámara en tiempo real
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Barcode / OCR local │
                         └──────────┬──────────┘
                                    │
                              si no funciona
                                    ▼
                         ┌─────────────────────┐
                         │   Vision Encoder    │
                         │    MobileCLIP       │
                         └──────────┬──────────┘
                                    │
                               embedding
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Matching Engine     │
                         │ cosine similarity   │
                         └──────────┬──────────┘
                                    │
                             candidatos
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────┐
│                       TU BACKEND API                          │
│                 Go + Fiber / PostgreSQL                       │
└──────────────┬──────────────────────┬────────────────────────┘
               │                      │
               ▼                      ▼
        Game Catalog             User System
               │                      │
               ▼                      ▼
        ScreenScraper             Libraries
        ingestion                  Reviews
                                   Progress
                                   Social
```

Pipeline de ingestión:

```text
ScreenScraper
     ↓
Importer
     ↓
Normalizer
     ↓
Filter
     ↓
Game Catalog
     ↓
Cover Embeddings
     ↓
Vector Index
```

---

# 4. Stack tecnológico recomendado

## Mobile

- React Native
- Expo
- TypeScript
- Expo Router
- NativeWind
- Zustand
- TanStack Query
- Axios
- Zod
- AsyncStorage / SQLite
- Expo SecureStore

## Cámara e identificación

- Expo Camera
- Barcode scanning
- ML Kit para OCR
- MobileCLIP / MobileCLIP2
- ONNX Runtime o Core ML para inferencia móvil
- MediaPipe Image Embedder como alternativa

## Backend

Elección principal:

- Go
- Fiber
- sqlc
- PostgreSQL

Alternativas:

- Spring Boot
- Spring Boot Native + GraalVM
- Kotlin + Ktor

## Datos

- PostgreSQL
- Redis
- Qdrant

Redis y Qdrant son opcionales inicialmente.

## Jobs

Si se necesita procesamiento asíncrono:

- Redis
- Asynq

## Infraestructura

- Docker
- Docker Compose
- Nginx
- GitHub Actions
- Prometheus
- Grafana
- Sentry

## API

- REST
- OpenAPI / Swagger
- `/api/v1`

## External data

- ScreenScraper como fuente inicial.

---

# 5. Mobile: React Native + Expo

Como el desarrollo previo ya usa React/TypeScript, React Native + Expo permite reutilizar muchos conceptos.

Crear aplicación:

```bash
npx create-expo-app@latest apps/mobile
```

Preferencia:

- TypeScript
- Expo Router

Estructura inicial:

```text
apps/mobile/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── library.tsx
│   │   ├── discover.tsx
│   │   └── profile.tsx
│   ├── scanner/
│   │   └── index.tsx
│   ├── game/
│   │   └── [id].tsx
│   └── review/
│       └── [id].tsx
├── components/
├── features/
├── services/
├── hooks/
├── store/
├── assets/
└── package.json
```

---

# 6. Cómo visualizar y desarrollar el frontend

Se pueden usar tres opciones.

## Teléfono físico

Recomendado para:

- Cámara.
- Barcode.
- OCR.
- MobileCLIP.
- Performance.
- Batería.

Ejecutar:

```bash
npx expo start
```

Abrir mediante Expo Go.

## Android Emulator

Usar Android Studio + Android Virtual Device.

Útil para:

- UI.
- Navegación.
- Diferentes tamaños.
- Estados.
- Debugging.

Para Expo:

```text
npx expo start
a
```

## Figma

Flujo recomendado:

```text
Figma
  ↓
Diseño
  ↓
React Native
  ↓
Expo Go
  ↓
Teléfono
```

---

# 7. Pantallas iniciales

No diseñar decenas de pantallas inicialmente.

Priorizar:

1. Home
2. Scanner
3. Resultados del scanner
4. Game Detail
5. Library
6. Profile
7. Review

## Home

Conceptualmente:

```text
GameShelf
────────────────────────
What are you playing?

[       SCAN GAME       ]

Recently Added

[Game] [Game] [Game]

Community
```

## Scanner

```text
← Scan Game

┌──────────────────┐
│                  │
│      COVER       │
│                  │
└──────────────────┘

Scanning...
● ● ●
```

Resultados:

```text
Possible matches

[Cover] Resident Evil 4
        PS2
        96% match

[Cover] Resident Evil 4
        GameCube
        89% match
```

## Game Detail

```text
[Cover]

Resident Evil 4
PlayStation 2

⭐ 4.7    128 reviews

[+ Add to library]

Your progress
███████████░░░ 75%

Reviews
```

## Library

```text
My Collection

127 games

[All] [Playing] [Completed] [Backlog]

[Game] [Game]
[Game] [Game]
```

## Profile

```text
Avatar

Username

127 games
73 completed
812 hours

⭐ 4.3

Recently played

Reviews
```

---

# 8. Organización del frontend por features

No crear un `components/` gigantesco.

```text
features/
├── scanner/
│   ├── ScannerScreen.tsx
│   ├── CameraView.tsx
│   ├── ScannerOverlay.tsx
│   ├── MatchResults.tsx
│   ├── MatchCard.tsx
│   ├── useScanner.ts
│   └── scanner.service.ts
├── games/
│   ├── GameCard.tsx
│   ├── GameCover.tsx
│   ├── GameDetail.tsx
│   └── game.service.ts
├── library/
│   ├── LibraryScreen.tsx
│   ├── LibraryCard.tsx
│   └── library.service.ts
├── reviews/
│   ├── ReviewCard.tsx
│   ├── ReviewForm.tsx
│   └── review.service.ts
└── profile/
    ├── ProfileScreen.tsx
    └── Stats.tsx
```

Componentes globales:

```text
components/
├── Button.tsx
├── Input.tsx
├── Modal.tsx
├── Avatar.tsx
├── Loading.tsx
└── EmptyState.tsx
```

---

# 9. Scanner: arquitectura

La cámara debería tener una estrategia por niveles.

```text
Camera
  ↓
Barcode
  ↓
¿match?
  ├── sí → resultado
  └── no
       ↓
      OCR
       ↓
   ¿resultado?
     ├── sí → búsqueda
     └── no
          ↓
      MobileCLIP
          ↓
       Embedding
          ↓
      API / Qdrant
          ↓
       Top 3/5
```

## Nivel 1: Barcode

Si se encuentra EAN/UPC:

```text
EAN
 ↓
API propia
 ↓
Game / Release
```

Es el método potencialmente más confiable.

## Nivel 2: OCR

Ejemplo:

```text
"Resident Evil 4"
"PlayStation 2"
```

Luego:

```text
OCR
 ↓
API
 ↓
candidatos
```

## Nivel 3: Vision Embedding

La cámara genera un embedding:

```text
[0.12, -0.45, 0.91, ...]
```

El catálogo tiene embeddings previamente calculados.

Se compara mediante similitud, normalmente cosine similarity.

---

# 10. IA móvil

## No empezar con una SLM

Para el MVP no es necesario ejecutar una SLM/VLM grande.

Una arquitectura más eficiente es:

```text
Imagen
 ↓
Barcode / OCR
 ↓
Vision Encoder
 ↓
Embedding
 ↓
Vector Search
```

Una SLM puede incorporarse posteriormente para:

- Normalizar texto OCR.
- Resolver nombres ambiguos.
- Convertir texto en estructura.
- Interpretar edición/plataforma.

Ejemplo:

```text
"Resident evil 4 ps2 platinum"

↓

{
  "title": "Resident Evil 4",
  "platform": "PlayStation 2",
  "edition": "Platinum"
}
```

---

# 11. MobileCLIP

Primera opción a evaluar:

- MobileCLIP-S0

Después:

- MobileCLIP-S2

El objetivo no es clasificación directa, sino embeddings.

```text
Portada
 ↓
MobileCLIP
 ↓
Embedding
```

El servidor tendría:

```text
Resident Evil 4 PS2
 ↓
embedding A

Resident Evil 4 GameCube
 ↓
embedding B

Resident Evil 5 PS3
 ↓
embedding C
```

La cámara genera:

```text
embedding QUERY
```

y se buscan los vectores más cercanos.

---

# 12. ONNX Runtime

Alternativa importante:

```text
PyTorch model
 ↓
ONNX
 ↓
ONNX Runtime
 ↓
React Native
 ↓
Android / iOS
```

Ventajas:

- Inferencia local.
- Sin necesidad de GPU de servidor.
- Puede optimizarse el modelo.
- Existe soporte para React Native.

---

# 13. MediaPipe

Otra alternativa:

- MediaPipe Image Embedder.

Puede utilizarse para comparar similitud entre imágenes y trabajar con feeds de vídeo.

No necesariamente tiene que ser la solución final, pero es una opción para prototipar.

---

# 14. Qdrant

En servidor:

```text
covers
 ↓
embedding
 ↓
Qdrant
```

El flujo:

```text
Mobile
 ↓
embedding
 ↓
POST /scanner/match
 ↓
Qdrant
 ↓
Top 5
 ↓
API
 ↓
JSON
```

Inicialmente no es necesario ejecutar Qdrant en el móvil.

Una posible evolución futura es evaluar un índice vectorial local/offline.

---

# 15. ScreenScraper

ScreenScraper debería ser tratado como:

> Fuente externa de datos, no como el catálogo de tu aplicación.

Crear un adapter:

```text
GameProvider
     │
     ├── ScreenScraperAdapter
     ├── IGDBAdapter (futuro)
     └── OtherProviderAdapter
```

La aplicación trabaja con entidades propias:

```text
Game
Release
Platform
Cover
```

No directamente con:

```text
ScreenScraperResponse
```

Esto permite cambiar de proveedor en el futuro.

---

# 16. Filtrado de ScreenScraper

Como el proyecto no quiere mods ni contenido no oficial, el proceso de importación debe aplicar filtros.

Ejemplos de categorías a excluir cuando correspondan:

```text
hack = 1      → excluir
unl = 1       → excluir
demo = 1      → excluir
beta = 1      → excluir
trad = 1      → excluir
alt = 1       → revisar/excluir según reglas
```

También deben crearse reglas propias para diferenciar:

- Juegos originales.
- Releases oficiales.
- Regiones.
- Ediciones físicas.
- Plataformas.
- Re-releases.
- Platinum/Greatest Hits.
- Versiones publicadas oficialmente.

La normalización es responsabilidad de la aplicación.

---

# 17. Pipeline de ingestión

```text
ScreenScraper
      ↓
Fetcher
      ↓
Normalizer
      ↓
Filter
      ↓
Deduplicator
      ↓
PostgreSQL
      ↓
Cover Downloader
      ↓
Embedding Generator
      ↓
Qdrant
```

El importer puede vivir inicialmente como un job.

No es necesario convertirlo desde el primer día en un microservicio independiente.

---

# 18. Backend

## Elección recomendada

```text
Go
+
Fiber
+
PostgreSQL
+
sqlc
```

Ventajas:

- Bajo consumo de memoria.
- Arranque rápido.
- Binario sencillo.
- Buen rendimiento.
- Muy adecuado para un VPS pequeño.
- Fácil despliegue con Docker.

## Spring Boot

Alternativa válida:

```text
Spring Boot
Spring Security
Spring Data JDBC/JPA
PostgreSQL
```

Y posteriormente:

```text
Spring Boot Native
+
GraalVM
```

Puede reducir memoria y tiempo de arranque frente a JVM tradicional.

Elegir Spring Boot si se prioriza:

- Ecosistema Java.
- Desarrollo profesional con Spring.
- Experiencia previa.
- Ecosistema empresarial.

Elegir Go Fiber si se prioriza:

- Ligereza.
- Bajo costo.
- Simplicidad de despliegue.

## Ktor

Otra alternativa:

```text
Kotlin + Ktor
```

Pero no aporta una ventaja clara sobre Go Fiber para este caso concreto.

---

# 19. Backend: Modular Monolith

No comenzar con microservicios.

```text
backend/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── auth/
│   ├── users/
│   ├── games/
│   ├── platforms/
│   ├── releases/
│   ├── covers/
│   ├── scanner/
│   ├── libraries/
│   ├── progress/
│   ├── reviews/
│   ├── comments/
│   ├── social/
│   └── feed/
├── infrastructure/
│   ├── postgres/
│   ├── redis/
│   ├── qdrant/
│   ├── screenscraper/
│   └── storage/
├── migrations/
└── pkg/
    ├── auth/
    ├── logger/
    └── errors/
```

Esto permite desarrollar rápidamente y separar módulos sin pagar el costo de los microservicios.

---

# 20. Patrones de diseño

## Repository Pattern

```text
HTTP Handler
     ↓
Service
     ↓
Repository
     ↓
PostgreSQL
```

Ejemplos:

- GameRepository
- UserRepository
- ReviewRepository
- LibraryRepository

## Service Layer

Ejemplos:

- GameService
- LibraryService
- ReviewService
- ScannerService

Los handlers HTTP no deberían contener toda la lógica de negocio.

## Strategy Pattern

Especialmente útil para scanner:

```text
ScannerStrategy
├── BarcodeStrategy
├── OCRStrategy
└── ImageEmbeddingStrategy
```

## Adapter Pattern

Especialmente importante para ScreenScraper:

```text
GameProvider
└── ScreenScraperAdapter
```

## Factory Pattern

Para cambiar modelos:

```text
EmbeddingModelFactory
├── MobileCLIP
├── MediaPipe
└── ONNX
```

## CQRS

No utilizar inicialmente.

Introducirlo solamente si existe una necesidad real.

## Eventos

Se pueden modelar eventos de dominio:

```text
GameCompleted
ReviewCreated
GameAdded
UserFollowed
```

Pero inicialmente no se necesita Kafka.

Una tabla `activities` puede ser suficiente para el feed.

---

# 21. Modelo de datos

## Game

```text
games
-----
id UUID PK
title
slug
description
developer
publisher
release_date
created_at
updated_at
```

## Platform

```text
platforms
---------
id
name
manufacturer
generation
```

Ejemplos:

- PlayStation 2
- Nintendo GameCube
- Xbox 360
- PC
- Nintendo Switch

## GamePlatform

```text
game_platforms
--------------
game_id
platform_id
```

## Release

Esta tabla representa una publicación concreta:

```text
releases
--------
id
game_id
platform_id
region
release_date
edition
physical
official
```

Ejemplo:

```text
Resident Evil 4

Release 1
PS2
USA
Standard
Physical

Release 2
PS2
Europe
Platinum
Physical

Release 3
GameCube
USA
Standard
Physical
```

## Cover

```text
covers
------
id
game_id
release_id
url
region
language
type
width
height
source
```

El embedding puede mantenerse en el índice vectorial y relacionarse mediante un ID.

## User

```text
users
-----
id
username
email
password_hash
avatar_url
bio
created_at
updated_at
```

## Library

```text
libraries
---------
id
user_id
name
description
is_public
created_at
```

Ejemplos:

- My Collection
- PS2 Collection
- Nintendo Collection
- Games to Play
- Favorites

## LibraryGame

Es recomendable guardar el `release_id`, no solamente `game_id`, porque el usuario puede poseer una edición física específica.

```text
library_games
-------------
library_id
game_id
release_id
status
progress
hours_played
added_at
started_at
completed_at
```

## Review

```text
reviews
-------
id
user_id
game_id
rating
title
content
spoiler
created_at
updated_at
```

## Follow

```text
follows
-------
follower_id
following_id
created_at
```

## Review Like

```text
review_likes
------------
review_id
user_id
created_at
```

## Comment

```text
comments
--------
id
review_id
user_id
content
created_at
```

## Activity

```text
activities
----------
id
user_id
type
entity_id
created_at
```

Puede utilizarse inicialmente para generar el feed social.

---

# 22. API propia

Base:

```text
/api/v1
```

## Auth

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/me
```

## Games

```http
GET /api/v1/games
GET /api/v1/games/{id}
GET /api/v1/games/search?q=zelda
GET /api/v1/games/{id}/releases
GET /api/v1/games/{id}/covers
```

## Scanner

```http
POST /api/v1/scanner/barcode
POST /api/v1/scanner/text
POST /api/v1/scanner/match
```

El cliente debería evitar enviar imágenes continuamente al backend si el embedding se puede generar localmente.

Ejemplo:

```json
{
  "embedding": [0.12, -0.45, 0.91],
  "platform_hint": "ps2"
}
```

o:

```json
{
  "barcode": "123456789"
}
```

Respuesta:

```json
{
  "matches": [
    {
      "game_id": "uuid",
      "release_id": "uuid",
      "title": "Resident Evil 4",
      "platform": "PlayStation 2",
      "region": "USA",
      "cover_url": "...",
      "similarity": 0.94
    },
    {
      "game_id": "uuid",
      "release_id": "uuid",
      "title": "Resident Evil 4",
      "platform": "GameCube",
      "region": "USA",
      "cover_url": "...",
      "similarity": 0.89
    }
  ]
}
```

## Libraries

```http
GET    /api/v1/libraries
POST   /api/v1/libraries
GET    /api/v1/libraries/{id}
PATCH  /api/v1/libraries/{id}
DELETE /api/v1/libraries/{id}

POST   /api/v1/libraries/{id}/games
DELETE /api/v1/libraries/{id}/games/{gameId}
```

## Progress

```http
PATCH /api/v1/games/{id}/progress
POST  /api/v1/games/{id}/start
POST  /api/v1/games/{id}/complete
```

## Reviews

```http
GET    /api/v1/games/{id}/reviews
POST   /api/v1/games/{id}/reviews

PATCH  /api/v1/reviews/{id}
DELETE /api/v1/reviews/{id}

POST   /api/v1/reviews/{id}/like
DELETE /api/v1/reviews/{id}/like

POST   /api/v1/reviews/{id}/comments
```

## Social

```http
POST   /api/v1/users/{id}/follow
DELETE /api/v1/users/{id}/follow

GET /api/v1/feed
GET /api/v1/users/{username}
```

---

# 23. Autenticación y seguridad

Mínimo:

- HTTPS
- JWT
- Refresh tokens
- Argon2id
- Rate limiting
- CORS
- Validación de entrada
- Protección contra SQL injection mediante acceso parametrizado
- Protección de endpoints de scanner

Especial atención:

```text
POST /scanner/match
```

Debe tener rate limiting para evitar abuso.

---

# 24. Redis y trabajos asíncronos

Redis es opcional al inicio.

Puede utilizarse para:

- Cache.
- Rate limiting.
- Sesiones.
- Jobs.
- Feed.
- Notificaciones.

Con Go:

```text
API
 ↓
enqueue
 ↓
Redis
 ↓
Asynq Worker
```

Trabajos posibles:

```text
ScreenScraper import
Embedding generation
Cover processing
Notifications
Feed generation
```

---

# 25. Almacenamiento de imágenes

No necesariamente hay que copiar todas las imágenes de ScreenScraper.

Durante indexación:

```text
ScreenScraper
 ↓
download temporal
 ↓
embedding
 ↓
delete
```

La base puede conservar:

```text
cover_url
embedding metadata
```

Si posteriormente se necesita controlar completamente los recursos, se puede añadir almacenamiento S3-compatible.

---

# 26. Monorepo

Sí es recomendable para este proyecto.

Importante:

> Monorepo no significa microservicios.

Puedes tener:

```text
MONOREPO
│
├── Mobile
├── API
├── Workers
├── AI
└── Admin
```

y desplegar cada parte independientemente.

## Estructura recomendada

```text
game-library/
│
├── apps/
│   ├── mobile/
│   ├── api/
│   └── admin/
│
├── packages/
│   ├── api-contracts/
│   ├── validation/
│   └── config/
│
├── ai/
│   ├── models/
│   ├── inference/
│   ├── evaluation/
│   ├── datasets/
│   └── notebooks/
│
├── workers/
│   ├── screenscraper-importer/
│   ├── embedding-generator/
│   └── image-processor/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   └── monitoring/
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   └── ai/
│
├── docker-compose.yml
├── README.md
└── .github/
    └── workflows/
```

Inicialmente los workers pueden ser simplemente jobs dentro del backend, y separarse cuando exista una necesidad real.

---

# 27. Monorepo y escalabilidad

## Etapa 1

```text
Monorepo
   │
   └── API
       └── Modular Monolith
```

## Etapa 2

```text
Monorepo
   │
   ├── API
   ├── Worker
   └── AI
```

## Etapa 3

```text
Monorepo
   │
   ├── game-service
   ├── user-service
   ├── social-service
   ├── scanner-service
   ├── recommendation-service
   └── workers
```

No es necesario migrar a varios repositorios.

---

# 28. Herramientas del monorepo

Por la mezcla de:

- TypeScript
- Go
- Python

no es necesario forzar una herramienta JavaScript para todo.

Una combinación sencilla:

- Git
- pnpm workspaces para TypeScript
- Makefile para comandos generales
- Docker Compose para infraestructura
- GitHub Actions para CI/CD

OpenAPI puede servir como contrato común:

```text
openapi.yaml
       │
       ├───────────────┐
       ▼               ▼
 TypeScript          Go
 types/client       models
```

---

# 29. Arquitectura de desarrollo completa

```text
┌──────────────────────────────────────────────┐
│                  VS CODE                     │
├──────────────────────────────────────────────┤
│                                              │
│  game-library/                               │
│                                              │
│  apps/mobile     ← frontend                  │
│  apps/api        ← backend                   │
│  ai/             ← modelos                   │
│  workers/        ← jobs                      │
│                                              │
└──────────────────────────────────────────────┘
           │
           │ docker compose
           ▼
┌──────────────────────────────────────────────┐
│                  Docker                      │
│                                              │
│ PostgreSQL   Redis   Qdrant   API            │
│                                              │
└──────────────────────────────────────────────┘
           │
           ▼
       Android
```

---

# 30. Desarrollo del frontend sin backend

No esperar a tener el backend.

Usar datos mock:

```typescript
const mockGame = {
  title: "Resident Evil 4",
  platform: "PlayStation 2",
  coverUrl: "...",
  rating: 4.7
};
```

Primero:

```text
mockGame
```

Después:

```text
GET /api/v1/games/:id
```

Esto permite avanzar en UI independientemente del backend.

---

# 31. Métricas de IA

No medir únicamente:

> "¿Reconoció el juego?"

Medir:

- Top-1 accuracy.
- Top-3 accuracy.
- Top-5 accuracy.
- False positive rate.
- Latencia.
- RAM.
- Consumo de batería.

Para esta aplicación, Top-3 puede ser especialmente importante porque la UI puede mostrar varias opciones.

Ejemplo:

```text
Top-1 = 91%
Top-3 = 98%
```

puede ser perfectamente útil para una experiencia de selección de candidatos.

---

# 32. Dataset de evaluación

Crear un dataset con:

```text
dataset/
├── ps2/
├── ps1/
├── gamecube/
├── xbox360/
└── switch/
```

Además de imágenes oficiales, incluir fotos reales tomadas con teléfonos:

- Diferentes ángulos.
- Mala iluminación.
- Reflejos.
- Plástico.
- Diferentes distancias.
- Portadas PAL/NTSC.
- Platinum.
- Greatest Hits.
- Diferentes idiomas.
- Diferentes ediciones.

Esto es mucho más representativo del uso real.

---

# 33. Entrenamiento

No empezar entrenando una IA propia.

Primero:

```text
ScreenScraper
 ↓
Catálogo de portadas
 ↓
MobileCLIP
 ↓
Embeddings
 ↓
Qdrant
```

Después crear dataset de evaluación.

Si el modelo no alcanza la precisión deseada:

```text
MobileCLIP
      ↓
fine-tuning
      ↓
Game Cover Encoder
```

La IA especializada en portadas sería una evolución posterior.

---

# 34. Infraestructura gratuita

Para desarrollo local:

```text
GitHub
Docker
PostgreSQL
Qdrant
Redis
Go
React Native
Expo
Python
Modelos open source
```

Todo puede ejecutarse localmente.

Para producción, los free tiers de proveedores cambian con el tiempo, por lo que no conviene diseñar la arquitectura dependiendo de que un proveedor mantenga indefinidamente una cuota gratuita específica.

---

# 35. Opción low-cost

Una sola VPS económica:

```text
                 VPS
┌───────────────────────────────────┐
│                                   │
│              Nginx                │
│                │                  │
│          ┌─────▼─────┐            │
│          │ Go Fiber  │            │
│          └─────┬─────┘            │
│                │                  │
│       ┌────────┼─────────┐        │
│       ▼        ▼         ▼        │
│   PostgreSQL Redis    Qdrant      │
│                                   │
│          Worker                   │
│                                   │
└───────────────────────────────────┘
```

Docker Compose:

```text
postgres
redis
qdrant
api
worker
nginx
```

No hace falta:

- Kubernetes.
- Microservicios.
- GPU de servidor.
- Kafka.
- Elasticsearch.
- LLM en servidor.

La inferencia visual ocurre en el móvil.

---

# 36. Por qué puede ser barato

El servidor no hace:

```text
❌ GPU inference
❌ LLM inference
❌ Image recognition server-side
❌ Video processing
```

Hace principalmente:

```text
CRUD
Authentication
Search
Vector lookup
Reviews
Social
```

Por tanto, el backend puede ejecutarse en una VPS relativamente pequeña.

---

# 37. CI/CD

GitHub Actions:

```text
git push
    ↓
Tests
    ↓
Lint
    ↓
Build
    ↓
Docker
    ↓
Deploy VPS
```

Puede configurarse para ejecutar solamente lo afectado.

Ejemplo conceptual:

```text
apps/mobile/** → mobile CI
apps/api/**    → backend CI
ai/**          → AI tests
```

---

# 38. Observabilidad

Inicialmente puede ser sencillo:

- Structured logs.
- Prometheus.
- Grafana.
- Sentry.

No es necesario montar ELK desde el comienzo.

---

# 39. Testing

## Backend

- Go testing.
- Testcontainers.
- Tests de servicios.
- Tests de repositories.
- Tests de API.

## Mobile

- Jest.
- React Native Testing Library.

## API

- OpenAPI.
- Swagger.
- Tests de integración.

## IA

Evaluar:

- Accuracy.
- Top-k.
- Latencia.
- Memoria.
- Consumo energético.
- Robustez ante fotografías reales.

---

# 40. Primera versión funcional

El primer objetivo no debería ser la red social.

Debe ser un **vertical slice**:

```text
📷 Cámara
   ↓
Barcode / OCR / MobileCLIP
   ↓
Embedding
   ↓
POST /scanner/match
   ↓
Go API
   ↓
Qdrant
   ↓
Top 3
   ↓
Mobile
   ↓
MatchCard
```

Cuando esto funcione:

```text
+ Add to Library
        ↓
PostgreSQL
        ↓
Library
```

Después:

```text
Library
 ↓
Progress
 ↓
Review
 ↓
Social
```

---

# 41. Orden de desarrollo sugerido

## Semana 1 — UI

Diseñar en Figma:

- Home.
- Library.
- Scanner.
- Game.
- Profile.

## Semana 2 — Mobile

Implementar:

- React Native.
- Expo.
- Navigation.
- State.
- API client.
- Componentes.

## Semana 3 — Scanner básico

Implementar:

- Camera.
- Barcode.
- OCR.

## Semana 4 — IA

Implementar:

- MobileCLIP.
- Embeddings.
- Matching.
- Evaluación.

## Semana 5 — Backend

Implementar:

- Go/Fiber.
- PostgreSQL.
- Qdrant.
- Scanner API.
- Game catalog.

## Semana 6 — Integración

```text
📷
 ↓
AI
 ↓
API
 ↓
Game
 ↓
Library
```

Después:

- Reviews.
- Follow.
- Feed.
- Likes.
- Comentarios.
- Notificaciones.
- Recomendaciones.

---

# 42. Stack definitivo recomendado

| Área | Tecnología |
|---|---|
| Mobile | React Native + Expo |
| Lenguaje mobile | TypeScript |
| UI | NativeWind |
| State | Zustand |
| Server state | TanStack Query |
| HTTP | Axios |
| Validación | Zod |
| Camera | Expo Camera |
| Barcode | ML Kit / Expo |
| OCR | ML Kit |
| Vision AI | MobileCLIP-S0/S2 |
| Inference | ONNX Runtime / Core ML |
| Backend | Go + Fiber |
| Data access | sqlc |
| Database | PostgreSQL |
| Cache | Redis |
| Jobs | Asynq |
| Vector DB | Qdrant |
| External catalog | ScreenScraper |
| API | REST + OpenAPI |
| Architecture | Modular Monolith |
| Patterns | Repository + Service + Strategy + Adapter + Factory |
| Auth | JWT + Refresh + Argon2id |
| Containers | Docker |
| Proxy | Nginx |
| CI/CD | GitHub Actions |
| Monitoring | Prometheus + Grafana |
| Error tracking | Sentry |
| Hosting | VPS low-cost |
| GPU servidor | No inicialmente |
| IA servidor | No inicialmente |

---

# 43. Arquitectura final resumida

```text
                         📱 MOBILE
                  React Native + Expo
                         │
              ┌──────────┴──────────┐
              │                     │
           Barcode             MobileCLIP
              │                     │
              └──────────┬──────────┘
                         ▼
                    HTTPS API
                         │
                    Go + Fiber
                         │
       ┌─────────────────┼──────────────────┐
       ▼                 ▼                  ▼
  PostgreSQL           Redis              Qdrant
       │                                    │
       ▼                                    ▼
 Game Catalog                         Vector Search
       ▲
       │
 ScreenScraper
       │
 Importer / Normalizer / Filter
```

---

# 44. Principios de arquitectura

1. **ScreenScraper no debe ser el contrato de tu aplicación.**
2. **Tu API debe ser la única fuente que consume la aplicación móvil.**
3. **El catálogo debe estar normalizado.**
4. **Game y Release deben ser entidades distintas.**
5. **La biblioteca debe poder guardar una release específica.**
6. **La IA móvil debe generar embeddings, no necesariamente clasificar directamente.**
7. **Barcode → OCR → Vision Embedding es una buena estrategia de fallback.**
8. **No empezar con una SLM.**
9. **No empezar con microservicios.**
10. **Usar Modular Monolith.**
11. **Usar Monorepo.**
12. **Usar OpenAPI como contrato.**
13. **Mover la inferencia al móvil para reducir costos de servidor.**
14. **Usar Qdrant para matching vectorial en servidor.**
15. **Empezar con una VPS pequeña.**
16. **Separar conceptualmente AI, API, Mobile e ingestión aunque estén en el mismo repositorio.**
17. **Medir Top-1/Top-3/Top-5 y no solamente "funciona/no funciona".**
18. **Validar primero el scanner antes de construir toda la red social.**

---

# 45. MVP recomendado

El MVP mínimo debería contener:

```text
[✓] Registro/login
[✓] Catálogo normalizado
[✓] Búsqueda manual
[✓] Cámara
[✓] Barcode
[✓] OCR
[✓] Matching visual
[✓] Resultados Top-3
[✓] Game detail
[✓] Crear biblioteca
[✓] Añadir juego físico
[✓] Estado/progreso
[✓] Rating
[✓] Review básica
```

Dejar para una segunda etapa:

```text
[ ] Follow
[ ] Feed
[ ] Likes
[ ] Comentarios
[ ] Notificaciones
[ ] Recomendaciones
[ ] Estadísticas avanzadas
[ ] Fine-tuning propio
[ ] Offline vector search
```

---

# 46. Decisión final

Para una primera implementación de bajo costo:

```text
Frontend
React Native + Expo + TypeScript
              ↓
Vision
MobileCLIP + ML Kit
              ↓
Backend
Go + Fiber
              ↓
Data
PostgreSQL
              ↓
Vector
Qdrant
              ↓
Jobs
Redis + Asynq
              ↓
Infrastructure
Docker + Nginx
              ↓
Hosting
1 VPS
```

Repositorio:

```text
Monorepo
```

Arquitectura backend:

```text
Modular Monolith
```

Estrategia de IA:

```text
Barcode
   ↓
OCR
   ↓
MobileCLIP
   ↓
Vector Search
```

Estrategia de escalamiento:

```text
Monolith
   ↓
Workers
   ↓
Servicios especializados
   ↓
Microservicios solamente si una necesidad real lo justifica
```

El foco inicial debe ser demostrar que la funcionalidad central funciona:

> **Una persona apunta la cámara a una portada física → la aplicación encuentra los candidatos correctos → el usuario selecciona la edición → la agrega a su biblioteca.**

Si ese flujo funciona bien, el resto de la aplicación —progreso, reviews, colecciones y comunidad— puede construirse encima de una base sólida.
