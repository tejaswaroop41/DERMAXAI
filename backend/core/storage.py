"""Artifact storage for local development and production S3 deployments."""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

from core.config import settings


class ArtifactStorage:
    """Store generated/user artifacts locally or in S3 without exposing the bucket."""

    def __init__(self) -> None:
        self.backend = os.getenv("STORAGE_BACKEND", "local").strip().lower()
        self.bucket = os.getenv("S3_BUCKET", "").strip()
        self.prefix = os.getenv("S3_PREFIX", "dermaxai").strip("/")
        self.region = os.getenv("AWS_REGION", "").strip() or None
        self.endpoint_url = os.getenv("S3_ENDPOINT_URL", "").strip() or None
        self._client = None

        if self.backend not in {"local", "s3"}:
            raise RuntimeError("STORAGE_BACKEND must be either 'local' or 's3'")
        if self.backend == "s3" and not self.bucket:
            raise RuntimeError("S3_BUCKET must be set when STORAGE_BACKEND=s3")

    @property
    def is_s3(self) -> bool:
        return self.backend == "s3"

    def _s3_client(self):
        if self._client is None:
            try:
                import boto3
            except ImportError as exc:  # pragma: no cover - dependency is pinned in production
                raise RuntimeError("boto3 is required when STORAGE_BACKEND=s3") from exc
            self._client = boto3.client(
                "s3",
                region_name=self.region,
                endpoint_url=self.endpoint_url,
            )
        return self._client

    def _key(self, key: str) -> str:
        clean = key.strip("/")
        return f"{self.prefix}/{clean}" if self.prefix else clean

    def uri_for(self, key: str) -> str:
        return f"s3://{self.bucket}/{self._key(key)}"

    def store_file(self, local_path: str, key: str) -> str:
        """Persist a local file and return its canonical stored path."""
        if not self.is_s3:
            return local_path
        if not Path(local_path).is_file():
            raise FileNotFoundError(local_path)
        object_key = self._key(key)
        self._s3_client().upload_file(local_path, self.bucket, object_key)
        return f"s3://{self.bucket}/{object_key}"

    def open(self, uri: str):
        """Return an open S3 StreamingBody for an s3:// URI."""
        bucket, key = self._parse_uri(uri)
        return self._s3_client().get_object(Bucket=bucket, Key=key)["Body"]

    def delete_local(self, local_path: str) -> None:
        try:
            Path(local_path).unlink(missing_ok=True)
        except OSError:
            pass

    @staticmethod
    def _parse_uri(uri: str) -> tuple[str, str]:
        parsed = urlparse(uri)
        if parsed.scheme != "s3" or not parsed.netloc or not parsed.path.strip("/"):
            raise ValueError("Invalid S3 artifact URI")
        return parsed.netloc, parsed.path.lstrip("/")


storage = ArtifactStorage()
