"""Tests for authentication — password hashing, JWT tokens."""

import pytest
from app.auth.security import hash_password, verify_password, create_access_token, SECRET_KEY, ALGORITHM
from jose import jwt


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "test-password-123"
        hashed = hash_password(password)
        assert hashed != password
        assert verify_password(password, hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # bcrypt uses random salt


class TestJWT:
    def test_create_and_decode(self):
        token = create_access_token({"sub": "testuser", "role": "tester"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "testuser"
        assert payload["role"] == "tester"
        assert "exp" in payload

    def test_token_contains_expiry(self):
        from datetime import timedelta
        token = create_access_token({"sub": "user"}, expires_delta=timedelta(hours=1))
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload
