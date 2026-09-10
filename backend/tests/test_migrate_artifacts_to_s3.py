from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts import migrate_artifacts_to_s3 as migration


class FakeStorage:
    is_s3 = True
    bucket = "private"

    def __init__(self):
        self.uploads = []
        self.heads = []

    def uri_for(self, key):
        return f"s3://private/{key}"

    def store_file(self, local_path, key):
        self.uploads.append((local_path, key))
        return self.uri_for(key)

    @staticmethod
    def _parse_uri(uri):
        prefix = "s3://private/"
        assert uri.startswith(prefix)
        return "private", uri[len(prefix) :]

    def _s3_client(self):
        return self

    def head_object(self, Bucket, Key):
        self.heads.append((Bucket, Key))
        return {}


class FakeSession:
    def __init__(self, diagnoses):
        self.diagnoses = diagnoses
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def query(self, model):
        return self

    def order_by(self, expression):
        return self

    def all(self):
        return self.diagnoses

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


def diagnosis(diagnosis_id, **paths):
    return SimpleNamespace(
        id=diagnosis_id,
        image_path=paths.get("image_path"),
        gradcam_path=paths.get("gradcam_path"),
        report_path=paths.get("report_path"),
    )


def test_dry_run_does_not_upload_or_commit(tmp_path, monkeypatch, capsys):
    image = tmp_path / "old-image.png"
    image.write_bytes(b"image")
    diag = diagnosis(42, image_path=str(image))
    session = FakeSession([diag])
    fake_storage = FakeStorage()

    monkeypatch.setattr(migration, "storage", fake_storage)
    monkeypatch.setattr(migration, "SessionLocal", lambda: session)

    stats = migration.migrate(dry_run=True, verify=False, delete_local_after_verify=False)

    assert stats.rows_seen == 1
    assert stats.files_seen == 1
    assert stats.migrated == 0
    assert fake_storage.uploads == []
    assert session.commits == 0
    assert image.exists()
    assert "diagnoses/42/image.png" in capsys.readouterr().out


def test_migration_updates_db_only_after_successful_upload(tmp_path, monkeypatch):
    image = tmp_path / "old-image.png"
    gradcam = tmp_path / "old-gradcam.jpg"
    report = tmp_path / "old-report.pdf"
    image.write_bytes(b"image")
    gradcam.write_bytes(b"gradcam")
    report.write_bytes(b"report")
    diag = diagnosis(
        42,
        image_path=str(image),
        gradcam_path=str(gradcam),
        report_path=str(report),
    )
    session = FakeSession([diag])
    fake_storage = FakeStorage()

    monkeypatch.setattr(migration, "storage", fake_storage)
    monkeypatch.setattr(migration, "SessionLocal", lambda: session)

    stats = migration.migrate(dry_run=False, verify=True, delete_local_after_verify=False)

    assert stats.migrated == 3
    assert stats.verified == 3
    assert stats.verification_failed == 0
    assert diag.image_path == "s3://private/dermaxai/diagnoses/42/image.png"
    assert diag.gradcam_path == "s3://private/dermaxai/diagnoses/42/gradcam.jpg"
    assert diag.report_path == "s3://private/dermaxai/diagnoses/42/report.pdf"
    assert session.commits == 1
    assert session.rollbacks == 0
    assert session.closed is True
    assert image.exists() and gradcam.exists() and report.exists()


def test_existing_s3_uri_is_skipped(tmp_path, monkeypatch):
    diag = diagnosis(7, image_path="s3://private/dermaxai/diagnoses/7/image.jpg")
    session = FakeSession([diag])
    fake_storage = FakeStorage()

    monkeypatch.setattr(migration, "storage", fake_storage)
    monkeypatch.setattr(migration, "SessionLocal", lambda: session)

    stats = migration.migrate(dry_run=False, verify=False, delete_local_after_verify=False)

    assert stats.already_s3 == 1
    assert stats.migrated == 0
    assert fake_storage.uploads == []
    assert session.commits == 0


def test_missing_local_file_is_reported_without_db_change(tmp_path, monkeypatch):
    missing = tmp_path / "missing.pdf"
    diag = diagnosis(9, report_path=str(missing))
    session = FakeSession([diag])
    fake_storage = FakeStorage()

    monkeypatch.setattr(migration, "storage", fake_storage)
    monkeypatch.setattr(migration, "SessionLocal", lambda: session)

    stats = migration.migrate(dry_run=False, verify=False, delete_local_after_verify=False)

    assert stats.missing == 1
    assert stats.migrated == 0
    assert diag.report_path == str(missing)
    assert session.commits == 0


def test_delete_requires_verification(monkeypatch):
    monkeypatch.setattr(migration, "storage", FakeStorage())

    with pytest.raises(ValueError, match="requires --verify"):
        migration.migrate(
            dry_run=False,
            verify=False,
            delete_local_after_verify=True,
        )


def test_local_mode_is_rejected(monkeypatch):
    fake_storage = SimpleNamespace(is_s3=False, bucket="")
    monkeypatch.setattr(migration, "storage", fake_storage)

    with pytest.raises(RuntimeError, match="STORAGE_BACKEND=s3"):
        migration.validate_configuration()
