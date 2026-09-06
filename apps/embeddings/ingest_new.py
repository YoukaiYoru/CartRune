# Pipeline de ingesta incremental.
#
# Indexa en Qdrant SOLO las portadas que aun no tienen punto (ideal para
# ejecutarse periodicamente despues de importar juegos nuevos), a diferencia
# de index_covers.py que re-indexa todo el catalogo.
#
# Uso:
#   python ingest_new.py                      # proceso principal
#   python ingest_new.py --watch              # bucle continuo (p.ej. cada 10 min)
#
# Automatizable con cron:
#   */10 * * * * cd apps/embeddings && .venv/bin/python ingest_new.py >> /tmp/ingest.log 2>&1

import os
import sys
import time

import psycopg2
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from mobileclip_engine import EMB_DIM, MobileClipEngine

POLL_SECONDS = 600


def make_dsn():
    if os.getenv("POSTGRES_DSN"):
        return os.getenv("POSTGRES_DSN")
    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")
    user = os.getenv("PGUSER", "postgres")
    pwd = os.getenv("PGPASSWORD", "postgres")
    dbname = os.getenv("PGDATABASE", "cartrune")
    return f"postgresql://{user}:{pwd}@{host}:{port}/{dbname}"


def indexed_ids(qdrant):
    """Ids de puntos ya presentes en la coleccion (scroll paginado)."""
    ids = set()
    offset = None
    while True:
        points, offset = qdrant.scroll(
            collection_name="game_covers", limit=1000, offset=offset, with_payload=False
        )
        ids.update(p.id for p in points)
        if offset is None:
            break
    return ids


def pending_covers(cur):
    sql = """
        SELECT c.id::text,
               g.id::text  AS game_id,
               r.id::text  AS release_id,
               g.title,
               p.name      AS platform,
               r.region
        FROM covers c
        JOIN games g  ON g.id = c.game_id
        LEFT JOIN LATERAL (
            SELECT r2.id, r2.region, r2.platform_id
            FROM releases r2
            WHERE r2.game_id = g.id
            ORDER BY r2.official DESC, r2.created_at ASC
            LIMIT 1
        ) r ON TRUE
        LEFT JOIN platforms p ON p.id = r.platform_id
        WHERE c.primary = TRUE
          AND c.url <> ''
    """
    cur.execute(sql)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def run_once(engine):
    qdrant = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
    if not qdrant.collection_exists("game_covers"):
        qdrant.create_collection(
            collection_name="game_covers",
            vectors_config=VectorParams(size=EMB_DIM, distance=Distance.COSINE),
        )

    existing = indexed_ids(qdrant)

    conn = psycopg2.connect(make_dsn())
    cur = conn.cursor()
    covers = [c for c in pending_covers(cur) if c["id"] not in existing]
    cur.close()
    conn.close()

    if not covers:
        print(f"[ingest] nada nuevo ({len(existing)} ya indexados)")
        return 0

    base = os.getenv("MEDIA_BASE_URL", "http://localhost:8080").rstrip("/")
    batch_size = int(os.getenv("BATCH_SIZE", "16"))
    points = []
    done = 0
    failed = 0
    for cover in covers:
        url = f"{base}/api/v1/media/covers/{cover['id']}"
        try:
            vec = engine.embed_url(url)
        except Exception as exc:  # noqa: BLE001
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
            qdrant.upsert(collection_name="game_covers", points=points)
            done += len(points)
            points = []
            print(f"[ingest] {done}/{len(covers)}")
    if points:
        qdrant.upsert(collection_name="game_covers", points=points)
        done += len(points)

    print(f"[ingest] nuevo indexado: {done} ok, {failed} fallos")
    return done


def main():
    engine = MobileClipEngine()
    watch = "--watch" in sys.argv
    while True:
        run_once(engine)
        if not watch:
            break
        time.sleep(int(os.getenv("POLL_SECONDS", str(POLL_SECONDS))))


if __name__ == "__main__":
    main()