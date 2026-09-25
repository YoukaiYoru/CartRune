# Indexador batch de portadas CartRune -> Qdrant.
#
# Recorre las portadas primarias del catalogo (Postgres), calcula su
# embedding MobileCLIP y los inserta/actualiza en la coleccion Qdrant
# "game_covers" (distancia coseno). Idempotente: se puede relanzar y
# solo cambia lo que haya variado (upsert por UUID de portada).
#
# Uso:
#   cd apps/embeddings
#   python -m venv .venv && . .venv/bin/activate
#   pip install -r requirements.txt
#   python index_covers.py
#
# Variables de entorno (ver .env.example):
#   POSTGRES_DSN      DSN de la base (o se forma con PG*_)
#   QDRANT_URL        http://host:6333
#   MEDIA_BASE_URL    raiz del API (para /api/v1/media/covers/{id})
#   MOBILECLIP_CKPT   checkpoint MobileCLIP (se descarga si falta)
#   DEVICE            cpu | cuda
#   BATCH_SIZE        puntos por upsert (ajuste: 1 para CPU pequeña)
#   LIMIT_QGAMES      limite opcional de juegos a procesar (debug)

import os

import psycopg2
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from mobileclip_engine import EMB_DIM, MobileClipEngine

COLLECTION = "game_covers"


def make_dsn():
    if os.getenv("POSTGRES_DSN"):
        return os.getenv("POSTGRES_DSN")
    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")
    user = os.getenv("PGUSER", "postgres")
    pwd = os.getenv("PGPASSWORD", "postgres")
    dbname = os.getenv("PGDATABASE", "cartrune")
    return f"postgresql://{user}:{pwd}@{host}:{port}/{dbname}"


def covers_to_index(cur):
    """Index physical cover variants with their exact release metadata."""
    sql = """
        SELECT c.id::text,
               g.id::text  AS game_id,
               COALESCE(r.id, fallback.id)::text AS release_id,
               g.title,
               COALESCE(p.name, fallback_platform.name) AS platform,
               COALESCE(r.region, fallback.region) AS region
        FROM covers c
        JOIN games g  ON g.id = c.game_id
        LEFT JOIN releases r ON r.id = c.release_id
        LEFT JOIN platforms p ON p.id = r.platform_id
        LEFT JOIN LATERAL (
            SELECT r2.id, r2.region, r2.platform_id
            FROM releases r2
            WHERE r2.game_id = g.id
            ORDER BY r2.official DESC, r2.created_at ASC
            LIMIT 1
        ) fallback ON r.id IS NULL
        LEFT JOIN platforms fallback_platform ON fallback_platform.id = fallback.platform_id
        WHERE c.url <> ''
          AND (c.primary = TRUE OR c.type LIKE 'box%' OR c.type LIKE 'support%')
          AND COALESCE(r.id, fallback.id) IS NOT NULL
        ORDER BY g.created_at DESC, c.id ASC
    """
    cur.execute(sql)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in rows]


def cover_url(base, cover_id):
    return f"{base}/api/v1/media/covers/{cover_id}"


def main():
    engine = MobileClipEngine()
    print(f"[worker] modelo listo ({engine.ckpt})")

    qdrant = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
    if not qdrant.collection_exists(COLLECTION):
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMB_DIM, distance=Distance.COSINE),
        )
        print(f"[worker] coleccion {COLLECTION} creada")

    conn = psycopg2.connect(make_dsn())
    cur = conn.cursor()
    covers = covers_to_index(cur)
    limit = os.getenv("LIMIT_QGAMES")
    if limit:
        covers = covers[: int(limit)]
    print(f"[worker] {len(covers)} portadas a indexar")

    base = os.getenv("MEDIA_BASE_URL", "http://localhost:8080").rstrip("/")
    batch_size = int(os.getenv("BATCH_SIZE", "16"))

    points = []
    done = 0
    failed = 0
    for cover in covers:
        url = cover_url(base, cover["id"])
        try:
            vec = engine.embed_url(url)
        except Exception as exc:  # noqa: BLE001 - no corta el batch completo
            print(f"  !! {cover['title']} ({cover['id']}): {exc}")
            failed += 1
            continue

        points.append(
            PointStruct(
                id=cover["id"],
                vector=vec,
                payload={
                    "game_id": cover["game_id"],
                    "release_id": cover["release_id"],
                    "title": cover["title"],
                    "platform": cover["platform"],
                    "region": cover["region"],
                    "cover_url": url,
                },
            )
        )
        if len(points) >= batch_size:
            qdrant.upsert(collection_name=COLLECTION, points=points)
            done += len(points)
            points = []
            print(f"[worker] {done}/{len(covers)} ({done * 100 // max(len(covers), 1)}%)")

    if points:
        qdrant.upsert(collection_name=COLLECTION, points=points)
        done += len(points)

    cur.close()
    conn.close()
    print(f"[worker] fin: {done} ok, {failed} fallos")


if __name__ == "__main__":
    main()
