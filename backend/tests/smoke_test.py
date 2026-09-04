"""
CI smoke test -- runs the full register -> diagnose -> doctor review flow
against a randomly-initialized checkpoint (never a real trained model;
real weights are never committed to git). This proves the application
wires together correctly -- routes, DB schema, auth, the AI pipeline --
without needing the actual 40MB+ trained checkpoint in CI.

Run manually with: python tests/smoke_test.py
Run in CI with the workflow in .github/workflows/ci.yml
"""
import sys
import os
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    # CRITICAL: every os.environ assignment below MUST happen before any
    # import of torch/core.*/app -- importing core.config triggers
    # load_dotenv() + instantiates the `settings` singleton immediately at
    # import time, and Python caches modules, so anything imported before
    # these assignments permanently bakes in stale values (e.g. from a
    # leftover local backend/.env) for the rest of the process, no matter
    # what os.environ is set to afterward. This bit us once already --
    # keep this ordering exactly as-is.
    os.makedirs("/tmp/ci_models", exist_ok=True)
    ckpt_path = "/tmp/ci_models/ci_test_checkpoint.pth"
    os.environ["MODEL_PATH"] = ckpt_path
    os.environ["SECRET_KEY"] = "ci-test-secret"
    os.environ["DATABASE_URL"] = "sqlite:////tmp/ci_test.db"
    os.environ["DEBUG"] = "true"
    if os.path.exists("/tmp/ci_test.db"):
        os.remove("/tmp/ci_test.db")

    import torch
    from core.model import DERMAXAIClassifier

    if not os.path.exists(ckpt_path):
        model = DERMAXAIClassifier(num_classes=7, dropout_rate=0.3,
                                   model_name="efficientnet_b3", pretrained=False)
        torch.save({"epoch": 0, "model_state": model.state_dict(), "combined_score": 0.0}, ckpt_path)

    from fastapi.testclient import TestClient
    from app import app
    from core.auth import hash_password
    from core.database import SessionLocal, User
    from PIL import Image
    import numpy as np

    with TestClient(app) as client:
        # Public registration is intentionally patient-only. The API must
        # reject attempts to self-register directly as a doctor.
        r = client.post("/api/auth/register", json={
            "email": "ci_rejected_doctor@test.com", "name": "Rejected Doctor",
            "password": "ValidPass123", "role": "doctor"})
        assert r.status_code == 403, f"Doctor self-registration was not rejected: {r.text}"

        # Password policy must reject short passwords and passwords without a number.
        r = client.post("/api/auth/register", json={
            "email": "ci_bad_password@test.com", "name": "Bad Password",
            "password": "short", "role": "patient"})
        assert r.status_code == 422, f"Short password was accepted: {r.text}"

        r = client.post("/api/auth/register", json={
            "email": "ci_bad_password2@test.com", "name": "Bad Password 2",
            "password": "onlyletters", "role": "patient"})
        assert r.status_code == 422, f"Password without a number was accepted: {r.text}"

        # Bootstrap an admin directly in the isolated CI database, then exercise the
        # real admin promotion endpoint to provision the doctor account.
        db = SessionLocal()
        try:
            admin = User(email="ci_admin@test.com", name="CI Admin",
                         hashed_password=hash_password("ciadmin123"), role="admin")
            db.add(admin)
            db.commit()
        finally:
            db.close()

        r = client.post("/api/auth/login", json={
            "email": "ci_admin@test.com", "password": "ciadmin123"})
        assert r.status_code == 200, f"Admin login failed: {r.text}"
        admin_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

        # Exercise the login limiter without consuming it before the real doctor login.
        for _ in range(8):
            r = client.post("/api/auth/login", json={
                "email": "ci_admin@test.com", "password": "wrong-password"})
            assert r.status_code == 401, f"Invalid login did not return 401: {r.text}"

        r = client.post("/api/auth/register", json={
            "email": "ci_patient@test.com", "name": "CI Patient",
            "password": "CiPass123", "role": "patient"})
        assert r.status_code == 200, f"Patient registration failed: {r.text}"
        patient_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

        r = client.post("/api/auth/register", json={
            "email": "ci_doctor@test.com", "name": "CI Doctor",
            "password": "CiPass123", "role": "patient"})
        assert r.status_code == 200, f"Doctor bootstrap registration failed: {r.text}"
        doctor_user_id = r.json()["user"]["id"]

        r = client.post(f"/api/admin/users/{doctor_user_id}/promote-doctor",
                        headers=admin_headers)
        assert r.status_code == 200, f"Doctor promotion failed: {r.text}"

        r = client.post("/api/auth/login", json={
            "email": "ci_doctor@test.com", "password": "CiPass123"})
        assert r.status_code == 200, f"Doctor login failed: {r.text}"
        doctor_headers = {"Authorization": f"Bearer {r.json()['access_token']}"}

        # One more failed login crosses the 10/minute login limit (admin success + 8
        # failures + doctor success = 10), proving the rate limiter is active.
        r = client.post("/api/auth/login", json={
            "email": "ci_admin@test.com", "password": "wrong-password"})
        assert r.status_code == 429, f"Login rate limiter did not return 429: {r.text}"

        img = Image.fromarray((np.random.rand(450, 600, 3) * 255).astype("uint8"))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)
        r = client.post("/api/diagnose", headers=patient_headers,
                        files={"image": ("test.jpg", buf, "image/jpeg")},
                        data={"symptoms": "ci smoke test", "age": "30"})
        assert r.status_code == 200, f"Diagnose failed: {r.text}"
        diag_id = r.json()["diagnosis_id"]
        assert "abcd_features" in r.json(), "ABCD features missing from response"

        r = client.get("/api/diagnose/history", headers=patient_headers)
        assert r.status_code == 200 and len(r.json()) == 1, f"History failed: {r.text}"

        r = client.get("/api/doctor/queue", headers=doctor_headers)
        assert r.status_code == 200, f"Doctor queue failed: {r.text}"

        r = client.post(f"/api/doctor/diagnoses/{diag_id}/claim", headers=doctor_headers)
        assert r.status_code == 200, f"Claim failed: {r.text}"

        r = client.post(f"/api/doctor/diagnoses/{diag_id}/review", headers=doctor_headers,
                        json={"verdict": "confirmed", "notes": "CI smoke test review"})
        assert r.status_code == 200, f"Review submit failed: {r.text}"

        r = client.get("/api/diagnose/notifications", headers=patient_headers)
        assert r.json()["unread_reviews"] == 1, f"Notification count wrong: {r.json()}"

        r = client.post("/api/diagnose/notifications/mark-seen", headers=patient_headers)
        assert r.json()["marked_seen"] == 1, f"Mark-seen wrong: {r.json()}"

    print("SMOKE TEST PASSED: auth policy, rate limiting, register, diagnose, ABCD, history, doctor queue, claim, review, notifications")


if __name__ == "__main__":
    main()
