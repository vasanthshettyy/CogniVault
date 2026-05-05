# CogniVault - API Contracts

This document defines the exact request/response schemas for all API endpoints.
All inter-module communication must follow these contracts.

---

## Standard Response Envelope

All endpoints return JSON in this format:

```json
{
  "status": "success" | "error",
  "message": "Human-readable description",
  "data": { } | [ ] | null
}
```

---

## Authentication

### POST /api/auth/register

**Request:**
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "SecurePass123",
  "gender": "female"
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "Account created successfully",
  "data": { "user_id": "uuid", "name": "Alice" }
}
```

### POST /api/auth/login

**Request:**
```json
{
  "email": "alice@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "access_token": "eyJ...",
    "token_type": "bearer",
    "user_id": "uuid",
    "name": "Alice"
  }
}
```

---

## Uploads

### POST /api/uploads/upload

**Request:** multipart/form-data with field `file`
**Auth:** Bearer token required

**Response (201):**
```json
{
  "status": "success",
  "message": "File uploaded successfully",
  "data": { "upload_id": "uuid", "file_name": "activity_log.csv", "file_type": "csv" }
}
```

### GET /api/uploads/list

**Auth:** Bearer token required

**Response (200):**
```json
{
  "status": "success",
  "message": "Uploads retrieved",
  "data": [
    {
      "upload_id": "uuid",
      "file_name": "log.csv",
      "file_type": "csv",
      "upload_status": "completed",
      "uploaded_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### DELETE /api/uploads/{upload_id}

**Auth:** Bearer token required

**Response (200):**
```json
{ "status": "success", "message": "Upload deleted", "data": null }
```

---

## Analysis

### POST /api/analysis/start

**Request:**
```json
{ "upload_id": "uuid" }
```

**Auth:** Bearer token required

**Response (202):**
```json
{
  "status": "success",
  "message": "Analysis started",
  "data": { "analysis_id": "uuid", "status": "queued" }
}
```

### GET /api/analysis/status/{analysis_id}

**Auth:** Bearer token required

**Response (200):**
```json
{
  "status": "success",
  "message": "Analysis complete",
  "data": {
    "analysis_id": "uuid",
    "status": "completed",
    "confidence_score": 87.5,
    "performance_metric": 82.0,
    "reasoning_steps": [...],
    "consistency_flags": [...]
  }
}
```

### GET /api/analysis/list

**Auth:** Bearer token required

**Response (200):** Array of analysis records.

---

## History

### GET /api/history/list

**Auth:** Bearer token required

**Response (200):**
```json
{
  "status": "success",
  "message": "History retrieved",
  "data": [
    {
      "history_id": "uuid",
      "file_name": "session_log.csv",
      "file_type": "csv",
      "analysis_id": "uuid",
      "confidence_score": 87.5,
      "performance_metric": 82.0,
      "viewed_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```
