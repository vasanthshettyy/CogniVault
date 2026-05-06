"""
CogniVault - Analysis Router
POST /api/analysis/start            - Start AI analysis for an upload.
GET  /api/analysis/status/{id}      - Poll analysis status and results.
GET  /api/analysis/list             - List all analyses for current user.
"""

import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from config import STORAGE_BUCKET
from models.schemas import AnalysisStartRequest
from utils.jwt_handler import verify_token
from db.supabase_client import get_supabase
from services.file_parser import parse_file
from services.preprocessor import clean_log_data
from services.upload_storage import is_local_storage_path, read_local_upload

router = APIRouter()


def run_analysis_pipeline(analysis_id: str, user_id: str, upload_id: str):
    """
    Background task: download file, parse, preprocess, run AI engine, store results.

    Parameters:
        analysis_id (str): UUID of the analysis record.
        user_id (str): UUID of the owning user.
        upload_id (str): UUID of the upload to analyze.
    """
    try:
        supabase = get_supabase()

        # Update status to processing
        supabase.table("ai_analyses").update(
            {"status": "processing"}
        ).eq("analysis_id", analysis_id).execute()

        # Get upload info
        upload = (
            supabase.table("user_uploads")
            .select("*")
            .eq("upload_id", upload_id)
            .execute()
        )

        if not upload.data or len(upload.data) == 0:
            raise ValueError("Upload not found")

        upload_record = upload.data[0]
        storage_path = upload_record["storage_path"]
        file_type = upload_record["file_type"]

        # Download file from the storage backend used at upload time.
        if is_local_storage_path(storage_path):
            file_bytes = read_local_upload(storage_path)
        else:
            file_bytes = supabase.storage.from_(STORAGE_BUCKET).download(storage_path)

        # Parse file
        parsed_data = parse_file(file_bytes, file_type)

        # Preprocess
        clean_data = clean_log_data(parsed_data)

        # Run AI engine
        from services.ai_engine import reconstruct_reasoning_with_retry
        result = reconstruct_reasoning_with_retry(clean_data)

        # Store results - Use json.dumps for valid JSON storage
        import json
        supabase.table("ai_analyses").update({
            "status": "completed",
            "confidence_score": result.get("confidence_score"),
            "performance_metric": result.get("performance_metric"),
            "missing_density": result.get("missing_density", 0.0),
            "reasoning_steps": result.get("reasoning_steps"),
            "consistency_flags": result.get("consistency_flags"),
            "raw_llm_response": json.dumps(result, default=str),
            "completed_at": datetime.utcnow().isoformat()
        }).eq("analysis_id", analysis_id).execute()

        # Create history record
        supabase.table("history").insert({
            "user_id": user_id,
            "upload_id": upload_id,
            "analysis_id": analysis_id
        }).execute()

    except Exception as e:
        # Update status to failed
        try:
            supabase = get_supabase()
            supabase.table("ai_analyses").update({
                "status": "failed",
                "error_message": str(e),
                "completed_at": datetime.utcnow().isoformat()
            }).eq("analysis_id", analysis_id).execute()
        except Exception:
            pass  # Best-effort error recording


@router.post("/start", status_code=status.HTTP_202_ACCEPTED)
async def start_analysis(
    request: AnalysisStartRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(verify_token)
):
    """
    Trigger AI analysis for a specific upload.
    Returns immediately with an analysis_id. Processing runs in background.

    Returns:
        202: Analysis started with analysis_id and status 'queued'.
        404: Upload not found or not owned by user.
        400: Upload still pending.
    """
    user_id = current_user["user_id"]

    try:
        supabase = get_supabase()

        # Verify upload ownership and status
        upload = (
            supabase.table("user_uploads")
            .select("upload_id, upload_status")
            .eq("upload_id", request.upload_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not upload.data or len(upload.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload not found"
            )

        if upload.data[0]["upload_status"] == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is still uploading. Please wait for upload to complete."
            )

        # Create analysis record
        result = supabase.table("ai_analyses").insert({
            "user_id": user_id,
            "upload_id": request.upload_id,
            "status": "queued"
        }).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create analysis record"
            )

        analysis_id = result.data[0]["analysis_id"]

        # Launch background task
        background_tasks.add_task(
            run_analysis_pipeline,
            analysis_id,
            user_id,
            request.upload_id
        )

        return {
            "status": "success",
            "message": "Analysis started",
            "data": {
                "analysis_id": analysis_id,
                "status": "queued"
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start analysis: {str(e)}"
        )


@router.get("/status/{analysis_id}")
async def get_analysis_status(
    analysis_id: str,
    current_user: dict = Depends(verify_token)
):
    """
    Poll the status and results of an analysis.

    Returns:
        200: Analysis status and results (if completed).
        404: Analysis not found.
    """
    user_id = current_user["user_id"]

    try:
        supabase = get_supabase()
        result = (
            supabase.table("ai_analyses")
            .select("*")
            .eq("analysis_id", analysis_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analysis not found"
            )

        analysis = result.data[0]

        response_data = {
            "analysis_id": analysis["analysis_id"],
            "status": analysis["status"],
        }

        if analysis["status"] == "completed":
            missing_density = _extract_field(analysis, "missing_density") or 0.0
            response_data.update({
                "confidence_score": analysis.get("confidence_score"),
                "performance_metric": analysis.get("performance_metric"),
                "missing_density": missing_density,
                "reasoning_steps": analysis.get("reasoning_steps"),
                "consistency_flags": analysis.get("consistency_flags"),
                "reconstructed_data_log": _extract_field(analysis, "reconstructed_data_log"),
                "reconstructed_steps": _extract_field(analysis, "reconstructed_steps"),
                "detected_patterns": _extract_field(analysis, "detected_patterns"),
                "predictive_foresight": _extract_field(analysis, "predictive_foresight"),
                "summary_text": _extract_field(analysis, "summary"),
            })
        elif analysis["status"] == "failed":
            response_data["error_message"] = analysis.get("error_message", "Unknown error")

        return {
            "status": "success",
            "message": f"Analysis {analysis['status']}",
            "data": response_data
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get analysis status: {str(e)}"
        )


@router.get("/list")
async def list_analyses(current_user: dict = Depends(verify_token)):
    """
    List all analyses for the current user, ordered by created_at DESC.

    Returns:
        200: Array of analysis records.
    """
    user_id = current_user["user_id"]

    try:
        supabase = get_supabase()
        result = (
            supabase.table("ai_analyses")
            .select("analysis_id, upload_id, status, confidence_score, performance_metric, created_at, completed_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        return {
            "status": "success",
            "message": "Analyses retrieved",
            "data": result.data or []
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve analyses: {str(e)}"
        )


def _extract_field(analysis: dict, field_name: str):
    """
    Extract a field from the raw_llm_response if not stored directly.
    """
    # Try direct field first
    direct = analysis.get(field_name)
    if direct is not None:
        return direct

    # Try parsing from raw_llm_response
    raw = analysis.get("raw_llm_response", "")
    if raw and isinstance(raw, str):
        try:
            import json
            # Try JSON first (new format)
            if raw.strip().startswith("{"):
                try:
                    parsed = json.loads(raw)
                    return parsed.get(field_name)
                except:
                    # Fallback to eval if it's a Python dict string (old format)
                    parsed = eval(raw)
                    return parsed.get(field_name)
        except Exception:
            pass

    return None
