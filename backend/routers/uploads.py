"""
CogniVault - Uploads Router
POST   /api/uploads/upload      - Upload a file (multipart/form-data).
GET    /api/uploads/list        - List all uploads for the current user.
DELETE /api/uploads/{upload_id} - Delete an upload and its storage file.
"""

import os
import re
import time
import uuid
import httpx
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from config import STORAGE_BUCKET
from utils.jwt_handler import verify_token
from db.supabase_client import get_supabase
from services.upload_storage import (
    delete_local_upload,
    is_local_storage_path,
    save_local_upload,
)

router = APIRouter()

# Allowed file types and max size (10 MB)
ALLOWED_EXTENSIONS = {"csv", "pdf", "xlsx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def safe_storage_filename(filename: str) -> str:
    """Return a path-safe filename while preserving the user's extension."""
    base_name = os.path.basename(filename or "upload")
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", base_name).strip("._")
    return safe_name or "upload"


def ensure_storage_bucket() -> None:
    """Create the upload bucket when it is missing in Supabase Storage."""
    try:
        supabase = get_supabase()

        # Try listing buckets to check if ours exists
        try:
            buckets = supabase.storage.list_buckets()
            bucket_ids = [getattr(b, "id", None) or b.get("id") for b in buckets]
            if STORAGE_BUCKET in bucket_ids:
                return  # Bucket already exists
        except Exception:
            pass  # If listing fails, try creating anyway

        # Create the bucket via the Supabase Python SDK
        try:
            supabase.storage.create_bucket(
                STORAGE_BUCKET,
                options={
                    "public": False,
                    "file_size_limit": MAX_FILE_SIZE,
                }
            )
            print(f"[STORAGE] Created bucket '{STORAGE_BUCKET}' successfully.")
            return
        except Exception as sdk_err:
            err_msg = str(sdk_err).lower()
            # If bucket already exists, that's fine
            if "already" in err_msg or "duplicate" in err_msg or "409" in err_msg:
                return

            # Fallback: try raw HTTP with service key
            supabase_url = os.getenv("SUPABASE_URL")
            service_key = os.getenv("SUPABASE_SERVICE_KEY")
            if supabase_url and service_key:
                storage_url = supabase_url.rstrip("/") + "/storage/v1/bucket"
                headers = {
                    "apikey": service_key,
                    "Authorization": f"Bearer {service_key}",
                    "Content-Type": "application/json",
                }
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(
                        storage_url,
                        headers=headers,
                        json={
                            "id": STORAGE_BUCKET,
                            "name": STORAGE_BUCKET,
                            "public": False,
                            "file_size_limit": MAX_FILE_SIZE,
                        },
                    )
                    if resp.status_code in (200, 201, 409):
                        return

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Could not create storage bucket '{STORAGE_BUCKET}': {sdk_err}"
            )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage bucket setup failed: {exc}"
        )


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(verify_token)
):
    """
    Accept a file, validate it, store in Supabase Storage, and record in DB.

    Validates:
    - File extension: must be .csv, .pdf, or .xlsx
    - File size: must be under 10 MB

    Returns:
        201: File uploaded with upload_id, file_name, file_type.
        400: Invalid file type or size.
    """
    user_id = current_user["user_id"]

    # Validate file extension
    original_filename = file.filename or ""
    safe_filename = safe_storage_filename(original_filename)
    file_ext = safe_filename.rsplit(".", 1)[-1].lower() if "." in safe_filename else ""
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '.{file_ext}'. Allowed: CSV, PDF, XLSX"
        )

    # Read file bytes
    file_bytes = await file.read()
    file_size = len(file_bytes)

    # Validate file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large ({file_size} bytes). Maximum is 10 MB"
        )

    try:
        supabase = get_supabase()
        # Ensure storage bucket exists (best-effort)
        try:
            ensure_storage_bucket()
        except Exception as bucket_err:
            print(f"[STORAGE BUCKET ERROR] {bucket_err}")

        # Generate unique storage path
        timestamp = int(time.time())
        storage_path = f"{user_id}/{timestamp}_{uuid.uuid4().hex}_{safe_filename}"

        # Upload to Supabase Storage first. If Storage is unavailable locally,
        # fall back to a local file so upload and analysis can still proceed.
        storage_backend = "supabase"
        try:
            supabase.storage.from_(STORAGE_BUCKET).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": file.content_type or "application/octet-stream"}
            )
        except Exception as storage_error:
            print(f"[UPLOAD STORAGE FALLBACK] {type(storage_error).__name__}: {storage_error}")
            storage_path = save_local_upload(storage_path, file_bytes)
            storage_backend = "local"

        # Record in database
        insert_data = {
            "user_id": user_id,
            "file_name": original_filename,
            "file_type": file_ext,
            "file_size_bytes": file_size,
            "storage_path": storage_path,
            "upload_status": "completed"
        }

        try:
            result = supabase.table("user_uploads").insert(insert_data).execute()
        except Exception:
            if storage_backend == "supabase":
                try:
                    supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
                except Exception:
                    pass
            elif is_local_storage_path(storage_path):
                delete_local_upload(storage_path)
            raise

        if not result.data or len(result.data) == 0:
            if storage_backend == "supabase":
                try:
                    supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
                except Exception:
                    pass
            elif is_local_storage_path(storage_path):
                delete_local_upload(storage_path)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record upload in database"
            )

        upload = result.data[0]

        return {
            "status": "success",
            "message": "File uploaded successfully",
            "data": {
                "upload_id": upload["upload_id"],
                "file_name": upload["file_name"],
                "file_type": upload["file_type"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[UPLOAD ERROR] {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )


@router.get("/list")
async def list_uploads(current_user: dict = Depends(verify_token)):
    """
    List all files uploaded by the current user, ordered by upload date DESC.

    Returns:
        200: Array of upload records.
    """
    user_id = current_user["user_id"]

    try:
        supabase = get_supabase()
        result = (
            supabase.table("user_uploads")
            .select("upload_id, file_name, file_type, file_size_bytes, upload_status, uploaded_at")
            .eq("user_id", user_id)
            .order("uploaded_at", desc=True)
            .execute()
        )

        return {
            "status": "success",
            "message": "Uploads retrieved",
            "data": result.data or []
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve uploads: {str(e)}"
        )


@router.delete("/{upload_id}")
async def delete_upload(upload_id: str, current_user: dict = Depends(verify_token)):
    """
    Delete a specific upload and its associated storage file.
    User can only delete their own uploads.
    CASCADE will remove associated analyses and history.

    Returns:
        200: Upload deleted.
        404: Upload not found or not owned by user.
    """
    user_id = current_user["user_id"]

    try:
        supabase = get_supabase()

        # Confirm ownership
        result = (
            supabase.table("user_uploads")
            .select("upload_id, storage_path")
            .eq("upload_id", upload_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload not found"
            )

        storage_path = result.data[0]["storage_path"]

        # Delete from the storage backend. This is best-effort because the DB
        # delete below is the source of truth for user-facing records.
        try:
            if is_local_storage_path(storage_path):
                delete_local_upload(storage_path)
            else:
                supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
        except Exception:
            pass

        # Delete from database (CASCADE handles analyses & history)
        supabase.table("user_uploads").delete().eq("upload_id", upload_id).execute()

        return {
            "status": "success",
            "message": "Upload deleted",
            "data": None
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Delete failed: {str(e)}"
        )
