"""
CogniVault API - Main Entry Point
FastAPI application with CORS middleware and router registration.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import auth, uploads, analysis, history
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="CogniVault API",
    description="Cognitive Trace Reconstruction System - AI-powered reasoning analysis from activity logs.",
    version="1.0.0"
)

# CORS - allow frontend to communicate with the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace * with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["Uploads"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(history.router, prefix="/api/history", tags=["History"])


import os

@app.get("/api/health")
def health_check():
    """Detailed health check."""
    return {
        "status": "success",
        "message": "All systems operational",
        "data": {
            "api": "running",
            "version": "1.0.0"
        }
    }


# Mount the frontend directory so FastAPI serves the HTML/JS/CSS files.
# Keep this last so it does not shadow API routes.
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
