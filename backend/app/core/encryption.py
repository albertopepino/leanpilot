"""Field-level encryption for sensitive database fields using Fernet symmetric encryption."""
from cryptography.fernet import Fernet
import base64
import hashlib
from app.core.config import get_settings


def get_fernet():
    """Derive a Fernet key from SECRET_KEY."""
    settings = get_settings()
    # Derive a 32-byte key from SECRET_KEY using SHA-256
    key = hashlib.sha256(settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_field(value: str) -> str:
    """Encrypt a string field."""
    if not value:
        return value
    f = get_fernet()
    return f.encrypt(value.encode()).decode()


def decrypt_field(value: str) -> str:
    """Decrypt a string field."""
    if not value:
        return value
    f = get_fernet()
    return f.decrypt(value.encode()).decode()
