import os

import pytest

from core.storage import ArtifactStorage


class FakeS3Client:
    def __init__(self):
        self.uploads = []
        self.objects = {}

    def upload_file(self, filename, bucket, key):
        self.uploads.append((filename, bucket, key))

    def get_object(self, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise KeyError((Bucket, Key))
        return {"Body": self.objects[(Bucket, Key)]}


def test_local_storage_returns_local_path(tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    storage = ArtifactStorage()
    path = tmp_path / "artifact.jpg"
    path.write_bytes(b"test")

    assert storage.is_s3 is False
    assert storage.store_file(str(path), "diagnoses/1/image.jpg") == str(path)


def test_s3_storage_uploads_under_configured_prefix(tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.setenv("S3_BUCKET", "dermaxai-private")
    monkeypatch.setenv("S3_PREFIX", "prod")
    storage = ArtifactStorage()
    client = FakeS3Client()
    storage._client = client

    path = tmp_path / "report.pdf"
    path.write_bytes(b"pdf")

    uri = storage.store_file(str(path), "diagnoses/42/report.pdf")

    assert uri == "s3://dermaxai-private/prod/diagnoses/42/report.pdf"
    assert client.uploads == [
        (str(path), "dermaxai-private", "prod/diagnoses/42/report.pdf")
    ]


def test_s3_uri_parser_rejects_invalid_uri(monkeypatch):
    monkeypatch.setenv("STORAGE_BACKEND", "s3")
    monkeypatch.setenv("S3_BUCKET", "dermaxai-private")
    storage = ArtifactStorage()

    with pytest.raises(ValueError, match="Invalid S3 artifact URI"):
        storage._parse_uri("https://example.com/object")

    assert storage._parse_uri("s3://bucket/path/to/file") == (
        "bucket",
        "path/to/file",
    )
