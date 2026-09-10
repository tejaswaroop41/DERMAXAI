import os
import unittest

os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-password-reset")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from sqlalchemy.orm import Session

from core.auth import (
    create_password_reset_token,
    decode_password_reset_token,
    hash_reset_nonce,
    reset_nonce_matches,
)
from core.database import Base, User, engine


class PasswordResetTokenTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

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

            second_update = (
                db.query(User)
                .filter(User.id == user_id, User.password_reset_nonce_hash == hash_reset_nonce(nonce))
                .update(
                    {User.hashed_password: "should-not-change"},
                    synchronize_session=False,
                )
            )
            self.assertEqual(second_update, 0)


if __name__ == "__main__":
    unittest.main()
