"""
Object storage service — S3-compatible Hetzner Object Storage.
Transparent fallback to local disk when S3 is not configured.

Key format: {factory_id}/{module}/{sub_type}/{uuid}{ext}
Examples:
  35/safety/incidents/a1b2c3d4.jpg
  35/kaizen/before/e5f6a7b8.jpg
  35/branding/logo.png
"""
import asyncio
import os
import uuid
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)

# Config from environment
_S3_ENDPOINT = os.environ.get("S3_ENDPOINT_URL", "")
_S3_ACCESS = os.environ.get("S3_ACCESS_KEY_ID", "")
_S3_SECRET = os.environ.get("S3_SECRET_ACCESS_KEY", "")
_S3_BUCKET = os.environ.get("S3_BUCKET_NAME", "leanos")
_S3_REGION = os.environ.get("S3_REGION", "eu-central")
_UPLOAD_BASE = os.environ.get("UPLOAD_BASE_DIR", "/app/uploads")

_s3_enabled = bool(_S3_ENDPOINT and _S3_ACCESS and _S3_SECRET)

def _get_client():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=_S3_ENDPOINT,
        aws_access_key_id=_S3_ACCESS,
        aws_secret_access_key=_S3_SECRET,
        region_name=_S3_REGION,
    )

def build_key(factory_id: int, module: str, filename: str, sub_type: str = "") -> str:
    if sub_type:
        return f"{factory_id}/{module}/{sub_type}/{filename}"
    return f"{factory_id}/{module}/{filename}"

async def upload_file(contents: bytes, key: str, content_type: str) -> str:
    if _s3_enabled:
        def _put():
            client = _get_client()
            client.put_object(Bucket=_S3_BUCKET, Key=key, Body=contents, ContentType=content_type)
        await asyncio.to_thread(_put)
        logger.info("storage.upload_s3", key=key, size=len(contents))
    else:
        local_path = os.path.join(_UPLOAD_BASE, key)
        def _write():
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(contents)
        await asyncio.to_thread(_write)
        logger.debug("storage.upload_local", path=local_path)
    return key

async def generate_presigned_url(key: str, expires_seconds: int = 3600) -> Optional[str]:
    if not _s3_enabled:
        return None
    def _sign():
        client = _get_client()
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": _S3_BUCKET, "Key": key},
            ExpiresIn=expires_seconds,
        )
    url = await asyncio.to_thread(_sign)
    return url

async def generate_presigned_download_url(key: str, filename: str, expires_seconds: int = 3600) -> Optional[str]:
    """Generate presigned URL with Content-Disposition: attachment for downloads."""
    if not _s3_enabled:
        return None
    def _sign():
        client = _get_client()
        return client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": _S3_BUCKET,
                "Key": key,
                "ResponseContentDisposition": f'attachment; filename="{filename}"',
            },
            ExpiresIn=expires_seconds,
        )
    url = await asyncio.to_thread(_sign)
    return url

async def delete_file(key: str) -> bool:
    if _s3_enabled:
        def _delete():
            client = _get_client()
            client.delete_object(Bucket=_S3_BUCKET, Key=key)
        await asyncio.to_thread(_delete)
        return True
    else:
        local_path = os.path.join(_UPLOAD_BASE, key)
        resolved = os.path.realpath(local_path)
        if resolved.startswith(os.path.realpath(_UPLOAD_BASE)) and os.path.exists(resolved):
            await asyncio.to_thread(os.remove, resolved)
            return True
        return False

async def get_file_bytes(key: str) -> bytes:
    if _s3_enabled:
        def _get():
            client = _get_client()
            response = client.get_object(Bucket=_S3_BUCKET, Key=key)
            return response["Body"].read()
        return await asyncio.to_thread(_get)
    else:
        local_path = os.path.join(_UPLOAD_BASE, key)
        resolved = os.path.realpath(local_path)
        if not resolved.startswith(os.path.realpath(_UPLOAD_BASE)):
            raise PermissionError("Path traversal")
        def _read():
            with open(resolved, "rb") as f:
                return f.read()
        return await asyncio.to_thread(_read)

def s3_enabled() -> bool:
    return _s3_enabled
