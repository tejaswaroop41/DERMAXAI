#!/usr/bin/env python3
"""Safely migrate DERMAXAI application data from SQLite to PostgreSQL.

The target database must already have the Alembic schema (``alembic upgrade head``).
The migration is transactional on PostgreSQL and refuses a non-empty target unless
``--allow-nonempty-target`` is explicitly supplied.

Usage:
    python backend/scripts/migrate_sqlite_to_postgres.py \
        --source sqlite:////absolute/path/dermaxai.db \
        --target "$DATABASE_URL" \
        --dry-run

    python backend/scripts/migrate_sqlite_to_postgres.py \
        --source sqlite:////absolute/path/dermaxai.db \
        --target "$DATABASE_URL"

This moves database rows only. Files referenced by image_path, gradcam_path and
report_path must be copied to the production storage separately.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Iterable

from sqlalchemy import MetaData, create_engine, inspect, select, text
from sqlalchemy.engine import Engine

TABLE_ORDER = ("users", "patients", "diagnoses", "doctor_reviews")
BATCH_SIZE = 500


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="SQLite SQLAlchemy URL")
    parser.add_argument("--target", required=True, help="PostgreSQL SQLAlchemy URL")
    parser.add_argument("--dry-run", action="store_true", help="Validate and report counts without writing")
    parser.add_argument(
        "--allow-nonempty-target",
        action="store_true",
        help="Permit migration into a target that already contains rows",
    )
    return parser.parse_args()


def validate_urls(source_url: str, target_url: str) -> None:
    if not source_url.startswith("sqlite:///"):
        raise ValueError("--source must be a SQLite SQLAlchemy URL")
    normalized = target_url.replace("postgres://", "postgresql://", 1)
    if not normalized.startswith("postgresql://"):
        raise ValueError("--target must be a PostgreSQL SQLAlchemy URL")


def reflect(engine: Engine) -> MetaData:
    metadata = MetaData()
    metadata.reflect(bind=engine, only=list(TABLE_ORDER))
    return metadata


def ensure_source_schema(source: MetaData) -> None:
    missing = [table for table in TABLE_ORDER if table not in source.tables]
    if missing:
        raise RuntimeError(f"Source SQLite database is missing tables: {missing}")


def ensure_required_source_columns(source: MetaData) -> None:
    required = {
        "users": {"id", "email", "name", "hashed_password"},
        "patients": {"id", "user_id"},
        "diagnoses": {"id"},
        "doctor_reviews": {"id", "diagnosis_id", "doctor_id"},
    }
    for table_name, columns in required.items():
        actual = {column.name for column in source.tables[table_name].columns}
        missing = sorted(columns - actual)
        if missing:
            raise RuntimeError(f"Source table {table_name!r} is missing required columns: {missing}")


def validate_source_invariants(source_engine: Engine, source: MetaData) -> None:
    users = source.tables["users"]
    patients = source.tables["patients"]
    diagnoses = source.tables["diagnoses"]
    reviews = source.tables["doctor_reviews"]

    with source_engine.connect() as conn:
        duplicate_emails = conn.execute(
            select(users.c.email)
            .group_by(users.c.email)
            .having(text("COUNT(*) > 1"))
        ).all()
        normalized_duplicates = conn.execute(
            text(
                'SELECT LOWER(TRIM(email)), COUNT(*) FROM "users" '
                'GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1'
            )
        ).all()
        if duplicate_emails or normalized_duplicates:
            raise RuntimeError(
                "Source contains duplicate user emails; resolve them before migration. "
                f"Normalized duplicates: {normalized_duplicates}"
            )

        duplicate_patients = conn.execute(
            select(patients.c.user_id)
            .group_by(patients.c.user_id)
            .having(text("COUNT(*) > 1"))
        ).all()
        if duplicate_patients:
            raise RuntimeError(
                "Source contains multiple patient rows for a user; "
                f"resolve user_ids first: {duplicate_patients}"
            )

        orphan_patients = conn.execute(
            text(
                'SELECT p.id FROM "patients" p LEFT JOIN "users" u ON u.id = p.user_id '
                'WHERE u.id IS NULL LIMIT 10'
            )
        ).all()
        orphan_diagnoses = conn.execute(
            text(
                'SELECT d.id FROM "diagnoses" d '
                'LEFT JOIN "users" u ON u.id = d.user_id '
                'LEFT JOIN "patients" p ON p.id = d.patient_id '
                'WHERE (d.user_id IS NOT NULL AND u.id IS NULL) '
                'OR (d.patient_id IS NOT NULL AND p.id IS NULL) LIMIT 10'
            )
        ).all()
        orphan_reviews = conn.execute(
            text(
                'SELECT r.id FROM "doctor_reviews" r '
                'LEFT JOIN "diagnoses" d ON d.id = r.diagnosis_id '
                'LEFT JOIN "users" u ON u.id = r.doctor_id '
                'WHERE d.id IS NULL OR u.id IS NULL LIMIT 10'
            )
        ).all()
        duplicate_reviews = conn.execute(
            select(reviews.c.diagnosis_id)
            .group_by(reviews.c.diagnosis_id)
            .having(text("COUNT(*) > 1"))
        ).all()

    problems = []
    if orphan_patients:
        problems.append(f"orphan patients={orphan_patients}")
    if orphan_diagnoses:
        problems.append(f"orphan diagnoses={orphan_diagnoses}")
    if orphan_reviews:
        problems.append(f"orphan reviews={orphan_reviews}")
    if duplicate_reviews:
        problems.append(f"duplicate review diagnoses={duplicate_reviews}")
    if problems:
        raise RuntimeError("Source foreign-key/integrity validation failed: " + "; ".join(problems))


def count_rows(engine: Engine, metadata: MetaData) -> dict[str, int]:
    with engine.connect() as conn:
        return {
            name: int(conn.execute(select(text("COUNT(*)")).select_from(metadata.tables[name])).scalar_one())
            for name in TABLE_ORDER
        }


def chunked(rows: Iterable[dict], size: int) -> Iterable[list[dict]]:
    batch: list[dict] = []
    for row in rows:
        batch.append(row)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch


def migrate(source_engine: Engine, target_engine: Engine, source: MetaData, target: MetaData) -> None:
    with target_engine.begin() as conn:
        for table_name in TABLE_ORDER:
            source_table = source.tables[table_name]
            target_table = target.tables[table_name]
            target_columns = {column.name for column in target_table.columns}
            source_columns = {column.name for column in source_table.columns}
            columns = [column.name for column in target_table.columns if column.name in source_columns]

            rows = source_engine.connect()
            try:
                result = rows.execute(select(source_table))
                for batch in chunked(
                    ({column: value for column, value in zip(result.keys(), row) if column in target_columns} for row in result),
                    BATCH_SIZE,
                ):
                    # Canonicalize emails exactly as the application does.
                    if table_name == "users":
                        for item in batch:
                            if item.get("email") is not None:
                                item["email"] = str(item["email"]).strip().lower()
                    if batch:
                        conn.execute(target_table.insert().values(batch))
            finally:
                rows.close()
            print(f"Migrated {table_name}")

        # Preserve explicit primary keys while aligning PostgreSQL sequences.
        for table_name in TABLE_ORDER:
            conn.execute(
                text(
                    "SELECT setval(pg_get_serial_sequence(:table, 'id'), "
                    "COALESCE((SELECT MAX(id) FROM \"" + table_name + "\"), 1), "
                    "(SELECT COUNT(*) > 0 FROM \"" + table_name + "\"))"
                ),
                {"table": table_name},
            )


def main() -> int:
    args = parse_args()
    validate_urls(args.source, args.target)
    target_url = args.target.replace("postgres://", "postgresql://", 1)

    source_engine = create_engine(args.source)
    target_engine = create_engine(target_url, pool_pre_ping=True)
    try:
        source = reflect(source_engine)
        target = reflect(target_engine)
        ensure_source_schema(source)
        ensure_required_source_columns(source)

        target_missing = [table for table in TABLE_ORDER if table not in target.tables]
        if target_missing:
            raise RuntimeError(
                "Target PostgreSQL schema is incomplete. Run `python -m alembic upgrade head` first. "
                f"Missing: {target_missing}"
            )

        validate_source_invariants(source_engine, source)
        source_counts = count_rows(source_engine, source)
        target_counts = count_rows(target_engine, target)
        print(f"Source row counts: {source_counts}")
        print(f"Target row counts: {target_counts}")

        if any(target_counts.values()) and not args.allow_nonempty_target:
            raise RuntimeError(
                "Target PostgreSQL database is not empty. Refusing to merge data; "
                "use --allow-nonempty-target only after an explicit backup/reconciliation plan."
            )

        if args.dry_run:
            print("Dry run complete: source validation passed; no rows written.")
            return 0

        migrate(source_engine, target_engine, source, target)
        final_counts = count_rows(target_engine, target)
        print(f"Target row counts after migration: {final_counts}")
        if final_counts != source_counts and not args.allow_nonempty_target:
            raise RuntimeError(
                f"Row-count verification failed: expected {source_counts}, got {final_counts}"
            )
        print("SQLite -> PostgreSQL migration completed successfully.")
        print("Reminder: migrate image/report/Grad-CAM files separately; database paths are not file contents.")
        return 0
    finally:
        source_engine.dispose()
        target_engine.dispose()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
