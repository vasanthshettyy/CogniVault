"""
CogniVault - History Router
GET /api/history/list - Return the full analysis history for the current user.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from utils.jwt_handler import verify_token
from db.supabase_client import get_supabase

router = APIRouter()


@router.get("/list")
async def list_history(current_user: dict = Depends(verify_token)):
    """
    Return the full analysis history for the current user.
    Joins history, user_uploads, and ai_analyses tables.
    Ordered by viewed_at DESC.

    Returns:
        200: Array of history records with file and analysis details.
    """
    user_id = current_user["user_id"]

    try:
        supabase = get_supabase()

        # Query history with joined data
        result = (
            supabase.table("history")
            .select(
                "history_id, "
                "user_uploads(file_name, file_type), "
                "ai_analyses(analysis_id, confidence_score, performance_metric, created_at)"
            )
            .eq("user_id", user_id)
            .execute()
        )

        # Transform joined data into flat records
        history_records = []
        for record in (result.data or []):
            upload_data = record.get("user_uploads", {}) or {}
            analysis_data = record.get("ai_analyses", {}) or {}
            # Use analysis creation time as the primary timestamp
            created_at = analysis_data.get("created_at")

            history_records.append({
                "history_id": record["history_id"],
                "file_name": upload_data.get("file_name", "Unknown"),
                "file_type": upload_data.get("file_type", ""),
                "analysis_id": analysis_data.get("analysis_id", ""),
                "confidence_score": analysis_data.get("confidence_score"),
                "performance_metric": analysis_data.get("performance_metric"),
                "created_at": created_at
            })
        
        # Sort by created_at DESC locally for final verification
        history_records.sort(key=lambda x: x.get("created_at") or "", reverse=True)

        return {
            "status": "success",
            "message": "History retrieved",
            "data": history_records
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve history: {str(e)}"
        )
