"""
Generic factory-scoped file upload service.

Folder layout:  {UPLOAD_BASE_DIR}/{module}/{factory_id}/{uuid}{ext}

Extracts common patterns from safety document and logo upload routes
into a reusable service with MIME validation, magic-byte checks, UUID
filenames, and asyncio.to_thread() for blocking I/O.
"""
import asyncio
import os
import uuid
from typing import Optional

from fastapi import HTTPException, UploadFile

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
    Validate and persist an uploaded file.

    Returns (relative_path, file_size) where relative_path is
    ``{factory_id}/{uuid}{ext}`` within the module directory.
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

    # Build paths
    ext = types[file.content_type]
    safe_name = f"{uuid.uuid4().hex}{ext}"
    factory_dir = os.path.join(UPLOAD_BASE_DIR, module, str(factory_id))
    file_path = os.path.join(factory_dir, safe_name)

    # Write (offload blocking I/O)
    def _write():
        os.makedirs(factory_dir, exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(contents)

    await asyncio.to_thread(_write)

    relative_path = f"{factory_id}/{safe_name}"
    return relative_path, len(contents)


def resolve_upload_path(module: str, relative_path: str) -> str:
    """
    Turn a stored relative_path back into an absolute disk path.

    Validates against path-traversal attacks.
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


async def delete_upload(module: str, relative_path: str) -> bool:
    """Delete an uploaded file. Returns True if the file was removed."""
    base = os.path.join(UPLOAD_BASE_DIR, module)
    safe = os.path.basename(relative_path.split("/")[-1])
    factory_id = relative_path.split("/")[0]
    full_path = os.path.join(base, factory_id, safe)

    resolved = os.path.realpath(full_path)
    if not resolved.startswith(os.path.realpath(base)):
        return False

    if os.path.exists(resolved):
        await asyncio.to_thread(os.remove, resolved)
        return True
    return False
