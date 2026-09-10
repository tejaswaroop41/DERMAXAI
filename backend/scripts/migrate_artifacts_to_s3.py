"""Migrate historical local diagnosis artifacts to private S3.

This utility is intentionally conservative:
- it requires STORAGE_BACKEND=s3 and a configured bucket;
- --dry-run performs no S3 or database writes;
- database paths are changed only after an upload succeeds;
- local files are never deleted unless --delete-local-after-verify is used;
- --delete-local-after-verify requires --verify and only deletes files whose
  database rows were successfully migrated and whose S3 objects verify.

Run from the backend directory, for example:
    python scripts/migrate_artifacts_to_s3.py --dry-run
    python scripts/migrate_artifacts_to_s3.py --verify
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

# Allow `python scripts/migrate_artifacts_to_s3.py` from backend/.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.database import Diagnosis, SessionLocal  # noqa: E402
from core.storage import storage  # noqa: E402


ARTIFACTS = (
    ("image_path", "image"),
    ("gradcam_path", "gradcam"),
    ("report_path", "report"),
)


@dataclass
class MigrationStats:
    rows_seen: int = 0
    files_seen: int = 0
    migrated: int = 0
    already_s3: int = 0
    missing: int = 0
    failed: int = 0
    verified: int = 0
    verification_failed: int = 0
    deleted: int = 0


def is_s3_uri(value: str | None) -> bool:
    return bool(value and value.strip().lower().startswith("s3://"))


def _extension(path: Path, kind: str) -> str:
    if kind == "gradcam":
        return ".jpg"
    if kind == "report":
        return ".pdf"
    suffix = path.suffix.lower()
    if suffix and suffix[1:].isalnum() and len(suffix) <= 9:
        return suffix
    return ".bin"


def target_key(diagnosis_id: int, kind: str, source: Path) -> str:
    return f"diagnoses/{diagnosis_id}/{kind}{_extension(source, kind)}"


def _object_exists(uri: str) -> bool:
    bucket, key = storage._parse_uri(uri)
    if bucket != storage.bucket:
        raise ValueError("S3 artifact URI references an unexpected bucket")
    try:
        storage._s3_client().head_object(Bucket=bucket, Key=key)
    except Exception:
        return False
    return True


def validate_configuration() -> None:
    if not storage.is_s3:
        raise RuntimeError(
            "Historical migration requires STORAGE_BACKEND=s3; no files were changed."
        )
    if not storage.bucket:
        raise RuntimeError("S3_BUCKET must be configured before migration.")


def migrate(*, dry_run: bool, verify: bool, delete_local_after_verify: bool) -> MigrationStats:
    validate_configuration()
    if delete_local_after_verify and not verify:
        raise ValueError("--delete-local-after-verify requires --verify")

    stats = MigrationStats()
    session = SessionLocal()
    migrated_sources: list[tuple[Diagnosis, str, Path, str]] = []

    try:
        diagnoses = session.query(Diagnosis).order_by(Diagnosis.id.asc()).all()
        stats.rows_seen = len(diagnoses)

        for diagnosis in diagnoses:
            changed = False
            for field, kind in ARTIFACTS:
                value = getattr(diagnosis, field)
                if not value:
                    continue
                if is_s3_uri(value):
                    stats.already_s3 += 1
                    continue

                stats.files_seen += 1
                source = Path(value).expanduser()
                if not source.is_file():
                    stats.missing += 1
                    print(f"MISSING diagnosis={diagnosis.id} {field}: {source}")
                    continue

                key = target_key(diagnosis.id, kind, source)
                target_uri = storage.uri_for(key)
                print(f"MIGRATE diagnosis={diagnosis.id} {field}: {source} -> {target_uri}")

                if dry_run:
                    continue

                try:
                    uploaded_uri = storage.store_file(str(source), key)
                    setattr(diagnosis, field, uploaded_uri)
                    migrated_sources.append((diagnosis, field, source, uploaded_uri))
                    changed = True
                    stats.migrated += 1
                except Exception as exc:
                    stats.failed += 1
                    print(f"FAILED diagnosis={diagnosis.id} {field}: {exc}")

            if changed and not dry_run:
                try:
                    session.commit()
                except Exception as exc:
                    session.rollback()
                    stats.failed += 1
                    print(f"FAILED DB commit diagnosis={diagnosis.id}: {exc}")
                    # The upload succeeded, but its DB pointer did not. The
                    # local source is retained and a later run can safely retry.
                    for item in list(migrated_sources):
                        if item[0] is diagnosis:
                            migrated_sources.remove(item)

        if verify and not dry_run:
            for diagnosis in diagnoses:
                for field, _kind in ARTIFACTS:
                    uri = getattr(diagnosis, field)
                    if not is_s3_uri(uri):
                        continue
                    try:
                        if _object_exists(uri):
                            stats.verified += 1
                        else:
                            stats.verification_failed += 1
                            print(f"VERIFY FAILED diagnosis={diagnosis.id} {field}: {uri}")
                    except Exception as exc:
                        stats.verification_failed += 1
                        print(f"VERIFY FAILED diagnosis={diagnosis.id} {field}: {exc}")

            if delete_local_after_verify and stats.verification_failed == 0:
                for _diagnosis, field, source, uri in migrated_sources:
                    if _object_exists(uri):
                        try:
                            source.unlink()
                            stats.deleted += 1
                            print(f"DELETED local diagnosis={_diagnosis.id} {field}: {source}")
                        except OSError as exc:
                            print(f"DELETE FAILED diagnosis={_diagnosis.id} {field}: {exc}")
    finally:
        session.close()

    return stats


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List migration work without uploading or changing the database.",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify every S3-backed diagnosis artifact with HeadObject after migration.",
    )
    parser.add_argument(
        "--delete-local-after-verify",
        action="store_true",
        help="Delete migrated local files only after --verify succeeds for all S3 artifacts.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        stats = migrate(
            dry_run=args.dry_run,
            verify=args.verify,
            delete_local_after_verify=args.delete_local_after_verify,
        )
    except (RuntimeError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 2

    print(
        "SUMMARY "
        f"rows_seen={stats.rows_seen} "
        f"files_seen={stats.files_seen} "
        f"migrated={stats.migrated} "
        f"already_s3={stats.already_s3} "
        f"missing={stats.missing} "
        f"failed={stats.failed} "
        f"verified={stats.verified} "
        f"verification_failed={stats.verification_failed} "
        f"deleted={stats.deleted}"
    )

    if stats.failed or stats.missing or stats.verification_failed:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
