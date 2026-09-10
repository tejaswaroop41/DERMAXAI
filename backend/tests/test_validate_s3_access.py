from types import SimpleNamespace

import pytest

from scripts import validate_s3_access as validation


class FakeBody:
    def __init__(self, payload):
        self.payload = payload

    def read(self):
        return self.payload


class FakeClient:
    def __init__(self):
        self.objects = {}
        self.deleted = []

    def put_object(self, *, Bucket, Key, Body, ContentType):
        self.objects[(Bucket, Key)] = Body
        return {}

    def head_object(self, *, Bucket, Key):
        return {"ContentLength": len(self.objects[(Bucket, Key)])}

    def get_object(self, *, Bucket, Key):
        return {"Body": FakeBody(self.objects[(Bucket, Key)])}

    def delete_object(self, *, Bucket, Key):
        self.deleted.append((Bucket, Key))
        self.objects.pop((Bucket, Key), None)
        return {}


def test_validate_configuration_requires_s3(monkeypatch):
    monkeypatch.setattr(
        validation,
        "storage",
        SimpleNamespace(is_s3=False, bucket="", prefix="dermaxai"),
    )
    with pytest.raises(RuntimeError, match="STORAGE_BACKEND=s3"):
        validation.validate_configuration()


def test_validate_access_round_trips_and_cleans_up(monkeypatch):
    client = FakeClient()
    fake_storage = SimpleNamespace(
        is_s3=True,
        bucket="private",
        prefix="dermaxai",
        _s3_client=lambda: client,
    )
    monkeypatch.setattr(validation, "storage", fake_storage)

    uri = validation.validate_access()

    assert uri.startswith("s3://private/dermaxai/_healthcheck/")
    assert client.deleted
    assert client.objects == {}


def test_validate_access_rejects_missing_bucket(monkeypatch):
    monkeypatch.setattr(
        validation,
        "storage",
        SimpleNamespace(is_s3=True, bucket="", prefix="dermaxai"),
    )
    with pytest.raises(RuntimeError, match="S3_BUCKET"):
        validation.validate_access()
