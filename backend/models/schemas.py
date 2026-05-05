"""
CogniVault - Pydantic Schemas
Request/response models for all API endpoints.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any, Dict
from datetime import datetime


# ── Authentication Schemas ──

class UserRegister(BaseModel):
    """Registration request body."""
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    gender: Optional[str] = Field(None, pattern="^(male|female|other|prefer_not_to_say)$")


class UserLogin(BaseModel):
    """Login request body."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    name: str


# ── API Response Envelope ──

class APIResponse(BaseModel):
    """Standard API response wrapper."""
    status: str
    message: str
    data: Optional[Any] = None


# ── Upload Schemas ──

class UploadResponse(BaseModel):
    """Upload success response data."""
    upload_id: str
    file_name: str
    file_type: str


class UploadRecord(BaseModel):
    """Single upload record for listing."""
    upload_id: str
    file_name: str
    file_type: str
    file_size_bytes: Optional[int] = None
    upload_status: str
    uploaded_at: Optional[str] = None


# ── Analysis Schemas ──

class ImputedAction(BaseModel):
    """Represents a single step in the full reconstructed timeline."""
    timestamp: str = Field(..., description="Timestamp of the action (original or predicted)")
    action: str = Field(..., description="The action name")
    resource: Optional[str] = Field(None, description="The resource involved")
    status: Optional[str] = Field(None, description="Success/Fail status")
    details: Optional[str] = Field(None, description="Additional context or AI-generated details")
    is_imputed: bool = Field(default=False, description="True if this specific row was generated/filled by AI")
    imputed_fields: List[str] = Field(default_factory=list, description="List of fields that were imputed")
    field_logic: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Granular reasoning per field")
    logic_path: Optional[str] = Field(None, description="The AI's reasoning for this step (if imputed)")
    confidence_score: float = Field(default=100.0, ge=0, le=100, description="Confidence in this step")


class AnalysisStartRequest(BaseModel):
    """Request to start an analysis."""
    upload_id: str


class CognitiveTraceAnalysis(BaseModel):
    """The complete structured output from the AI engine."""
    summary: str
    reconstructed_steps: List[str]
    reasoning_steps: List[dict]
    detected_patterns: List[str]
    consistency_flags: List[dict]
    confidence_score: float
    performance_metric: float
    reconstructed_data_log: List[ImputedAction] = Field(default_factory=list, description="List of imputed data points.")


class AnalysisStatus(BaseModel):
    """Analysis status and results."""
    analysis_id: str
    status: str
    confidence_score: Optional[float] = None
    performance_metric: Optional[float] = None
    reasoning_steps: Optional[List[dict]] = None
    consistency_flags: Optional[List[dict]] = None
    reconstructed_steps: Optional[List[str]] = None
    detected_patterns: Optional[List[str]] = None
    summary: Optional[str] = None
    reconstructed_data_log: Optional[List[ImputedAction]] = None
    error_message: Optional[str] = None


# ── History Schemas ──

class HistoryRecord(BaseModel):
    """Single history record."""
    history_id: str
    file_name: str
    file_type: str
    analysis_id: str
    confidence_score: Optional[float] = None
    performance_metric: Optional[float] = None
    viewed_at: Optional[str] = None
