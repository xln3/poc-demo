"""Fernet symmetric encryption for API keys stored in the database."""

import os
from cryptography.fernet import Fernet

_ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY")

def _get_fernet() -> Fernet:
    if not _ENCRYPTION_KEY:
        raise RuntimeError(
            "ENCRYPTION_KEY environment variable not set. "
            "Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        )
    return Fernet(_ENCRYPTION_KEY.encode() if isinstance(_ENCRYPTION_KEY, str) else _ENCRYPTION_KEY)


def encrypt_api_key(plain_key: str) -> str:
    """Encrypt an API key for database storage."""
    return _get_fernet().encrypt(plain_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an API key from database storage."""
    return _get_fernet().decrypt(encrypted_key.encode()).decode()


def mask_api_key(key: str) -> str:
    """Return a masked version of an API key for display (e.g. sk-...abcd)."""
    if len(key) <= 8:
        return "****"
    return key[:3] + "..." + key[-4:]
