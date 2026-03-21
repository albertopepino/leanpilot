"""
Generic factory-scoped file upload service.

Storage key layout:  {factory_id}/{module}/{uuid}{ext}

Delegates to storage.py for S3 or local-disk persistence.
"""
import os
import uuid
from typing import Optional

from fastapi import HTTPException, UploadFile

from app.services import storage as storage_svc

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

UPLOAD_BASE_DIR = os.environ.get("UPLOAD_BASE_DIR", "/app/uploads")

# Allowed image MIME types (default for photo uploads)
IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
}

# Extended set including documents
DOCUMENT_TYPES: dict[str, str] = {
    **IMAGE_TYPES,
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "text/plain": ".txt",
}

DEFAULT_MAX_SIZE = 10 * 1024 * 1024  # 10 MB

# Magic bytes for basic file-type validation
_MAGIC = {
    "image/png": (b"\x89PNG", 4),
    "image/jpeg": (b"\xff\xd8", 2),
    "application/pdf": (b"%PDF", 4),
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def save_upload(
    file: UploadFile,
    module: str,
    factory_id: int,
    allowed_types: Optional[dict[str, str]] = None,
    max_size: int = DEFAULT_MAX_SIZE,
) -> tuple[str, int]:
    """
    Validate and persist an uploaded file via storage service (S3 or local).

    Returns (storage_key, file_size) where storage_key is
    ``{factory_id}/{module}/{uuid}{ext}``.
    """
    types = allowed_types or IMAGE_TYPES

    # MIME check
    if not file.content_type or file.content_type not in types:
        accepted = ", ".join(sorted(types.values()))
        raise HTTPException(400, f"File type not allowed. Accepted: {accepted}")

    # Read contents
    contents = await file.read()
    if len(contents) > max_size:
        mb = max_size // (1024 * 1024)
        raise HTTPException(400, f"File too large. Maximum {mb} MB.")

    # Magic byte validation (where available)
    magic = _MAGIC.get(file.content_type)
    if magic:
        expected_bytes, length = magic
        if contents[:length] != expected_bytes:
            raise HTTPException(400, f"Invalid {file.content_type} file (magic bytes mismatch).")

    # Build storage key
    ext = types[file.content_type]
    safe_name = f"{uuid.uuid4().hex}{ext}"
    storage_key = storage_svc.build_key(factory_id, module, safe_name)

    # Persist via storage service (S3 or local disk)
    await storage_svc.upload_file(contents, storage_key, file.content_type)

    # Return a backward-compatible relative_path format: {factory_id}/{safe_name}
    # This is what gets stored in DB columns (e.g. photo_url, file_path)
    relative_path = f"{factory_id}/{safe_name}"
    return relative_path, len(contents)


def resolve_upload_path(module: str, relative_path: str) -> str:
    """
    Turn a stored relative_path back into an absolute disk path.

    Validates against path-traversal attacks.
    Only works in local-disk mode. For S3 mode, use storage.get_file_bytes()
    or storage.generate_presigned_url() instead.
    """
    base = os.path.join(UPLOAD_BASE_DIR, module)
    safe = os.path.basename(relative_path.split("/")[-1])
    factory_id = relative_path.split("/")[0]
    full_path = os.path.join(base, factory_id, safe)

    resolved = os.path.realpath(full_path)
    if not resolved.startswith(os.path.realpath(base)):
        raise HTTPException(403, "Invalid file path")

    if not os.path.exists(resolved):
        raise HTTPException(404, "File not found")

    return resolved


def _build_storage_key_from_relative(module: str, relative_path: str) -> str:
    """Convert a DB-stored relative_path (e.g. '35/abc123.jpg') to a storage key."""
    safe = os.path.basename(relative_path.split("/")[-1])
    factory_id = relative_path.split("/")[0]
    return f"{factory_id}/{module}/{safe}"


async def delete_upload(module: str, relative_path: str) -> bool:
    """Delete an uploaded file from storage (S3 or local)."""
    key = _build_storage_key_from_relative(module, relative_path)
    return await storage_svc.delete_file(key)
