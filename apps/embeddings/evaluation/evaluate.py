# Evaluador del matcher visual.
#
# Ejecuta las consultas del dataset contra Qdrant y reporta hit@1 / hit@5
# (y el top-1 correcto). Permite validar el rendimiento de MobileCLIP-S0
# antes de ajustar el umbral de similitud de /scanner/match.
#
# Uso:
#   python evaluate.py dataset.csv
#   python evaluate.py dataset.csv --top 3   # detalles por consulta

import csv
import sys

import psycopg2
from qdrant_client import QdrantClient

from mobileclip_engine import MobileClipEngine

COLLECTION = "game_covers"


def make_dsn():
    import os

    if os.getenv("POSTGRES_DSN"):
        return os.getenv("POSTGRES_DSN")
    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")
    user = os.getenv("PGUSER", "postgres")
    pwd = os.getenv("PGPASSWORD", "postgres")
    dbname = os.getenv("PGDATABASE", "cartrune")
    return f"postgresql://{user}:{pwd}@{host}:{port}/{dbname}"


def cover_urls():
    """cover uuid -> url media proxy, desde el catalogo."""
    conn = psycopg2.connect(make_dsn())
    cur = conn.cursor()
    cur.execute("SELECT id::text, url FROM covers WHERE url <> ''")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return {rid: url for rid, url in rows}


def evaluate(dataset_path, topk, verbose):
    engine = MobileClipEngine()
    qdrant = QdrantClient(url="http://localhost:6333")
    urls = cover_urls()
    base = "http://localhost:8080"

    hits_at_1 = 0
    hits_at_k = 0
    total = 0
    with open(dataset_path) as fh:
        rows = list(csv.DictReader(fh))

    for row in rows:
        qid = row["query_cover_id"].strip()
        expected = row["expected_game_id"].strip()
        if not qid or not expected or qid.startswith("<"):
            continue

        url = urls.get(qid)
        if not url:
            print(f"?? cover desconocido: {qid}")
            continue

        vec = engine.embed_url(base + "/api/v1/media/covers/" + qid)
        hits = qdrant.search(
            collection_name=COLLECTION,
            query_vector=vec,
            limit=topk,
        )

        top_titles = [h.payload.get("title") for h in hits]
        top_game_ids = {h.payload.get("game_id") for h in hits}

        total += 1
        if hits and hits[0].payload.get("game_id") == expected:
            hits_at_1 += 1
        if expected in top_game_ids:
            hits_at_k += 1

        if verbose:
            flag = "OK" if expected in top_game_ids else "X"
            print(f"[{flag}] {row['title']}: {top_titles[:topk]}")

    print(f"\nhit@{topk}: {hits_at_k}/{total} ({hits_at_k / max(total, 1):.1%})")
    print(f"hit@1:  {hits_at_1}/{total} ({hits_at_1 / max(total, 1):.1%})")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "evaluation/dataset.csv"
    verbose = "--verbose" in sys.argv
    topk = 5
    if "--topk" in sys.argv:
        topk = int(sys.argv[sys.argv.index("--topk") + 1])
    evaluate(path, topk, verbose)