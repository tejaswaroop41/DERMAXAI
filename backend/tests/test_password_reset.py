import os
import unittest

os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-password-reset")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from core.auth import (
    create_password_reset_token,
    create_token,
    decode_password_reset_token,
    decode_token,
    get_current_user,
    hash_reset_nonce,
    reset_nonce_matches,
)
from core.database import Base, User, create_tables, engine


class PasswordResetTokenTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        create_tables()

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=engine)

    def test_token_contains_password_reset_purpose_and_nonce(self):
        nonce = "nonce-123"
        token = create_password_reset_token(42, nonce)
        user_id, decoded_nonce = decode_password_reset_token(token)
        self.assertEqual(user_id, 42)
        self.assertEqual(decoded_nonce, nonce)

    def test_wrong_nonce_does_not_match(self):
        stored = hash_reset_nonce("correct-nonce")
        self.assertTrue(reset_nonce_matches(stored, "correct-nonce"))
        self.assertFalse(reset_nonce_matches(stored, "wrong-nonce"))
        self.assertFalse(reset_nonce_matches(None, "correct-nonce"))

    def test_nonce_is_consumed_after_password_reset_update(self):
        with Session(engine) as db:
            user = User(
                email="reset-test@example.com",
                name="Reset Test",
                hashed_password="old-hash",
                role="patient",
                password_reset_nonce_hash=hash_reset_nonce("one-time"),
            )
            db.add(user)
            db.commit()
            user_id = user.id

            nonce = "one-time"
            updated = (
                db.query(User)
                .filter(User.id == user_id, User.password_reset_nonce_hash == hash_reset_nonce(nonce))
                .update(
                    {
                        User.hashed_password: "new-hash",
                        User.password_reset_nonce_hash: None,
                    },
                    synchronize_session=False,
                )
            )
            db.commit()
            self.assertEqual(updated, 1)

            refreshed = db.query(User).filter(User.id == user_id).one()
            self.assertEqual(refreshed.hashed_password, "new-hash")
            self.assertIsNone(refreshed.password_reset_nonce_hash)
            self.assertFalse(reset_nonce_matches(refreshed.password_reset_nonce_hash, nonce))
            self.assertEqual(refreshed.token_version, 1)

            second_update = (
                db.query(User)
                .filter(User.id == user_id, User.password_reset_nonce_hash == hash_reset_nonce(nonce))
                .update(
                    {User.hashed_password: "should-not-change"},
                    synchronize_session=False,
                )
            )
            self.assertEqual(second_update, 0)

    def test_access_token_uses_current_token_version_and_old_token_is_rejected(self):
        with Session(engine) as db:
            user = User(
                email="session-reset@example.com",
                name="Session Reset",
                hashed_password="old-hash",
                role="patient",
            )
            db.add(user)
            db.commit()
            user_id = user.id

            token = create_token({"sub": user_id, "role": user.role})
            payload = decode_token(token)
            self.assertEqual(payload["token_version"], 0)

            db.query(User).filter(User.id == user_id).update(
                {User.hashed_password: "new-hash"}, synchronize_session=False
            )
            db.commit()
            db.refresh(user)
            self.assertEqual(user.token_version, 1)

            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            with self.assertRaises(HTTPException) as ctx:
                get_current_user(credentials, db)
            self.assertEqual(ctx.exception.status_code, 401)
            self.assertIn("revoked", str(ctx.exception.detail).lower())

            fresh_token = create_token({"sub": user_id, "role": user.role})
            fresh_payload = decode_token(fresh_token)
            self.assertEqual(fresh_payload["token_version"], 1)
            self.assertEqual(get_current_user(
                HTTPAuthorizationCredentials(scheme="Bearer", credentials=fresh_token), db
            ).id, user_id)

    def test_deactivation_also_revokes_existing_access_token(self):
        with Session(engine) as db:
            user = User(
                email="deactivate-session@example.com",
                name="Deactivate Session",
                hashed_password="old-hash",
                role="patient",
            )
            db.add(user)
            db.commit()
            user_id = user.id

            token = create_token({"sub": user_id, "role": user.role})
            db.query(User).filter(User.id == user_id).update(
                {User.is_active: False}, synchronize_session=False
            )
            db.commit()

            refreshed = db.query(User).filter(User.id == user_id).one()
            self.assertEqual(refreshed.token_version, 1)
            credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            with self.assertRaises(HTTPException) as ctx:
                get_current_user(credentials, db)
            self.assertEqual(ctx.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
