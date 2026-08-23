"""Migra una copia local de security_logs.db a DATABASE_URL.

Uso (PowerShell):
    $env:DATABASE_URL='postgresql://...'
    python migrate_sqlite_to_postgres.py
"""

from __future__ import annotations

import os
import sqlite3
from pathlib import Path


if not os.environ.get("DATABASE_URL") and not os.environ.get("POSTGRES_URL"):
    raise SystemExit("Define DATABASE_URL antes de ejecutar la migración.")

import app  # noqa: E402  (inicializa el esquema PostgreSQL)


SOURCE = Path(os.environ.get("SQLITE_SOURCE", Path(__file__).with_name("security_logs.db")))
TABLES = {
    "users": "email",
    "visits": "id",
    "stripe_customers": "email",
    "google_tokens": "email",
    "schedules": "email",
}


def migrate() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"No se encontró la base SQLite: {SOURCE}")

    source = sqlite3.connect(SOURCE)
    source.row_factory = sqlite3.Row
    target = app.get_db_connection()
    target_cursor = target.cursor()

    counts: dict[str, int] = {}
    try:
        for table, conflict_key in TABLES.items():
            exists = source.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
            ).fetchone()
            if not exists:
                continue

            rows = source.execute(f'SELECT * FROM "{table}"').fetchall()
            counts[table] = 0
            for row in rows:
                columns = list(row.keys())
                column_sql = ", ".join(f'"{column}"' for column in columns)
                placeholders = ", ".join("?" for _ in columns)
                target_cursor.execute(
                    f'INSERT INTO "{table}" ({column_sql}) VALUES ({placeholders}) '
                    f'ON CONFLICT ("{conflict_key}") DO NOTHING',
                    tuple(row[column] for column in columns),
                )
                counts[table] += 1

        target_cursor.execute(
            "SELECT setval(pg_get_serial_sequence('visits', 'id'), "
            "COALESCE((SELECT MAX(id) FROM visits), 1), true)"
        )
        target.commit()
    finally:
        source.close()
        target.close()

    for table, count in counts.items():
        print(f"{table}: {count} filas revisadas")
    print("Migración terminada.")


if __name__ == "__main__":
    migrate()
