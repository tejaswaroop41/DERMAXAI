"""Validate the EC2 instance role can use the configured private S3 artifact prefix.

The check creates one temporary object under the configured application prefix,
reads it back, and deletes it again. It is intended to be run from the
production backend environment before switching STORAGE_BACKEND to s3.
"""
from __future__ import annotations

import argparse
import sys
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.storage import storage  # noqa: E402


def validate_configuration() -> None:
    if not storage.is_s3:
        raise RuntimeError("S3 access validation requires STORAGE_BACKEND=s3")
    if not storage.bucket:
        raise RuntimeError("S3_BUCKET must be configured")
    if not storage.prefix:
        raise RuntimeError("S3_PREFIX must be configured")


def validate_access() -> str:
    validate_configuration()
    client = storage._s3_client()
    key = f"_healthcheck/{uuid.uuid4().hex}.txt"
    if storage.prefix:
        key = f"{storage.prefix}/{key}"

    payload = b"DERMAXAI S3 access validation\n"
    uri = f"s3://{storage.bucket}/{key}"

    try:
        client.put_object(Bucket=storage.bucket, Key=key, Body=payload, ContentType="text/plain")
        metadata = client.head_object(Bucket=storage.bucket, Key=key)
        if metadata.get("ContentLength") != len(payload):
            raise RuntimeError("S3 object length verification failed")

        response = client.get_object(Bucket=storage.bucket, Key=key)
        body = response["Body"].read()
        if body != payload:
            raise RuntimeError("S3 object content verification failed")
        return uri
    finally:
        try:
            client.delete_object(Bucket=storage.bucket, Key=key)
        except Exception as exc:
            raise RuntimeError(
                f"S3 validation object could not be cleaned up: s3://{storage.bucket}/{key}"
            ) from exc


def build_parser() -> argparse.ArgumentParser:
    return argparse.ArgumentParser(description=__doc__)


def main() -> int:
    build_parser().parse_args()
    try:
        uri = validate_access()
    except (RuntimeError, ValueError) as exc:
        print(f"ERROR: {exc}")
        return 2
    print(f"S3 ACCESS OK: {uri}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
