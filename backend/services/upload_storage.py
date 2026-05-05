"""
Upload storage helpers.

Supabase Storage is the primary backend. A local fallback keeps uploads and
analysis working in development when the Storage bucket is missing or blocked.
"""

from pathlib import Path
import os


LOCAL_STORAGE_PREFIX = "local://"


def is_local_storage_path(storage_path: str) -> bool:
    return storage_path.startswith(LOCAL_STORAGE_PREFIX)


def _local_upload_root() -> Path:
    configured = os.getenv("COGNIVAULT_LOCAL_UPLOAD_DIR")
    if configured:
        return Path(configured).expanduser().resolve()

    return Path(__file__).resolve().parents[1] / ".tmp" / "uploads"


def _local_path_from_storage_path(storage_path: str) -> Path:
    if not is_local_storage_path(storage_path):
        raise ValueError("Not a local storage path")

    relative_path = storage_path[len(LOCAL_STORAGE_PREFIX):].lstrip("/\\")
    root = _local_upload_root().resolve()
    local_path = (root / relative_path).resolve()

    if root != local_path and root not in local_path.parents:
        raise ValueError("Invalid local storage path")

    return local_path


def save_local_upload(relative_storage_path: str, file_bytes: bytes) -> str:
    """Store bytes locally and return the DB storage_path value."""
    local_storage_path = f"{LOCAL_STORAGE_PREFIX}{relative_storage_path}"
    local_path = _local_path_from_storage_path(local_storage_path)
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(file_bytes)
    return local_storage_path


def read_local_upload(storage_path: str) -> bytes:
    return _local_path_from_storage_path(storage_path).read_bytes()


def delete_local_upload(storage_path: str) -> None:
    local_path = _local_path_from_storage_path(storage_path)
    try:
        local_path.unlink()
    except FileNotFoundError:
        return
