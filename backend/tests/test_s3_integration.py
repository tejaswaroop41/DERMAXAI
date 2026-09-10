from types import SimpleNamespace

from core import s3_integration


def test_store_diagnosis_artifacts_uploads_all_local_artifacts(tmp_path, monkeypatch):
    image = tmp_path / "upload.png"
    gradcam = tmp_path / "heatmap.jpg"
    report = tmp_path / "report.pdf"
    image.write_bytes(b"image")
    gradcam.write_bytes(b"heatmap")
    report.write_bytes(b"report")

    diag = SimpleNamespace(
        id=42,
        image_path=str(image),
        gradcam_path=str(gradcam),
        report_path=str(report),
    )

    class FakeStorage:
        is_s3 = True

        def __init__(self):
            self.uploads = []

        def store_file(self, path, key):
            self.uploads.append((path, key))
            return f"s3://private/{key}"

        @staticmethod
        def delete_local(path):
            __import__("pathlib").Path(path).unlink(missing_ok=True)

    class FakeSession:
        def __init__(self):
            self.merged = None
            self.committed = False
            self.rolled_back = False
            self.closed = False

        def merge(self, value):
            self.merged = value

        def commit(self):
            self.committed = True

        def rollback(self):
            self.rolled_back = True

        def close(self):
            self.closed = True

    fake_storage = FakeStorage()
    fake_db = FakeSession()
    monkeypatch.setattr(s3_integration, "storage", fake_storage)
    monkeypatch.setattr(s3_integration, "SessionLocal", lambda: fake_db)

    s3_integration._store_diagnosis_artifacts(diag)

    assert diag.image_path == "s3://private/diagnoses/42/image.png"
    assert diag.gradcam_path == "s3://private/diagnoses/42/gradcam.jpg"
    assert diag.report_path == "s3://private/diagnoses/42/report.pdf"
    assert fake_db.merged is diag
    assert fake_db.committed is True
    assert fake_db.rolled_back is False
    assert fake_db.closed is True
    assert all(not path.exists() for path in (image, gradcam, report))


def test_artifact_uri_detection_and_content_types():
    assert s3_integration._artifact_uri("s3://private/dermaxai/a.pdf") is True
    assert s3_integration._artifact_uri("/data/reports/a.pdf") is False
    assert s3_integration._content_type("image.jpg") == "image/jpeg"
    assert s3_integration._content_type("report.pdf") == "application/pdf"
