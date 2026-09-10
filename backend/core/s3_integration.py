"""Integrate persisted diagnosis artifacts with the configured artifact store."""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from fastapi import Request
from fastapi.responses import JSONResponse, Response, StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware

from core.auth import decode_token
from core.database import SessionLocal, Diagnosis, User
from core.storage import storage

logger = logging.getLogger("dermaxai.storage")


def _current_user(request: Request, db):
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    try:
        payload = decode_token(header.split(" ", 1)[1].strip())
        if payload.get("purpose") is not None:
            return None
        user_id = int(payload.get("sub"))
    except Exception:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    return user if user and user.is_active else None


def _can_view(diag: Diagnosis, user: User) -> bool:
    return bool(user and (diag.user_id == user.id or user.role == "doctor"))


def _content_type(path: str) -> str:
    suffix = Path(path).suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".pdf": "application/pdf",
    }.get(suffix, "application/octet-stream")


def _artifact_uri(uri: str | None) -> bool:
    return bool(uri and uri.startswith("s3://"))


def _store_diagnosis_artifacts(diag: Diagnosis) -> None:
    """Upload all locally generated artifacts before deleting local copies."""
    if not storage.is_s3:
        return

    updates: dict[str, str] = {}
    local_paths: list[str] = []
    artifacts = (
        ("image_path", "image"),
        ("gradcam_path", "gradcam.jpg"),
        ("report_path", "report.pdf"),
    )

    for field, fixed_name in artifacts:
        local_path = getattr(diag, field)
        if not local_path or _artifact_uri(local_path):
            continue
        path = Path(local_path)
        if not path.is_file():
            continue
        if field == "image_path":
            fixed_name = f"image{path.suffix.lower() or '.bin'}"
        key = f"diagnoses/{diag.id}/{fixed_name}"
        updates[field] = storage.store_file(str(path), key)
        local_paths.append(str(path))

    if not updates:
        return

    for field, uri in updates.items():
        setattr(diag, field, uri)

    db = SessionLocal()
    try:
        db.merge(diag)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    for local_path in local_paths:
        storage.delete_local(local_path)


class S3ArtifactMiddleware(BaseHTTPMiddleware):
    """Upload successful diagnosis artifacts and stream private S3 artifacts."""

    async def dispatch(self, request: Request, call_next):
        if not storage.is_s3:
            return await call_next(request)

        path = request.url.path
        if request.method == "GET" and (
            path.startswith("/api/diagnose/") and path.endswith("/gradcam")
            or path.startswith("/api/reports/")
        ):
            response = await self._serve_s3_artifact(request, path)
            if response is not None:
                return response

        response = await call_next(request)
        if request.method == "POST" and path == "/api/diagnose" and 200 <= response.status_code < 300:
            try:
                body = b"".join([chunk async for chunk in response.body_iterator])
                payload = json.loads(body)
                diagnosis_id = int(payload["diagnosis_id"])
                db = SessionLocal()
                try:
                    diag = db.query(Diagnosis).filter(Diagnosis.id == diagnosis_id).first()
                    if diag:
                        _store_diagnosis_artifacts(diag)
                finally:
                    db.close()
                headers = dict(response.headers)
                headers.pop("content-length", None)
                return Response(
                    content=body,
                    status_code=response.status_code,
                    headers=headers,
                    media_type=response.media_type,
                )
            except Exception:
                logger.exception("S3 artifact persistence failed; retaining local artifacts")
        return response

    async def _serve_s3_artifact(self, request: Request, path: str):
        try:
            if path.startswith("/api/diagnose/"):
                diagnosis_id = int(path.split("/")[3])
                field = "gradcam_path"
            else:
                diagnosis_id = int(path.rsplit("/", 1)[1])
                field = "report_path"
        except (ValueError, IndexError):
            return None

        db = SessionLocal()
        try:
            user = _current_user(request, db)
            diag = db.query(Diagnosis).filter(Diagnosis.id == diagnosis_id).first()
            if not diag or not user or not _can_view(diag, user):
                return None
            uri = getattr(diag, field)
            if not _artifact_uri(uri):
                return None
            body = storage.open(uri)
            headers = {}
            if field == "report_path":
                headers["Content-Disposition"] = f'attachment; filename="DERMAXAI_Report_{diagnosis_id}.pdf"'
            return StreamingResponse(body.iter_chunks(chunk_size=1024 * 1024), media_type=_content_type(uri), headers=headers)
        except Exception:
            logger.exception("S3 artifact retrieval failed")
            return JSONResponse(status_code=404, content={"detail": "Artifact not found"})
        finally:
            db.close()


def install_storage_integration(app) -> None:
    """Install S3 behavior on the production app without changing local mode."""
    if storage.is_s3:
        app.add_middleware(S3ArtifactMiddleware)
