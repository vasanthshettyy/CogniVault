# Cognitive Trace Reconstruction System - Master Roadmap

---

## PART 1: System Ground Rules and Development Protocols

This section defines the absolute rules all AI developer agents must follow before writing any code. No exceptions are permitted. Any agent that violates these rules produces work that will be rejected and re-done.

---

### Rule 1: Zero Budget Strictness

- All infrastructure, APIs, and services used in this project must be free-tier or completely free.
- Supabase free tier is the only allowed database. Do not suggest AWS RDS, PlanetScale paid, Firebase Blaze, or any hosted PostgreSQL with billing.
- For AI/ML, use either Google Gemini API (free tier via Google AI Studio) or Groq API (free tier). Do not use OpenAI, Anthropic Claude API, or any paid LLM endpoint.
- File storage must use Supabase Storage free tier (1 GB limit). Do not suggest AWS S3, Cloudinary paid, or any CDN with billing.
- Hosting must use free services: backend on Render free tier or Railway free tier, frontend on GitHub Pages or Vercel free tier.
- Every dependency, library, and package used must be open-source with no usage fees.
- If any agent cannot implement a feature within free-tier constraints, it must flag the limitation clearly in a comment rather than suggesting a paid workaround.

---

### Rule 2: Modular Independence

- The system is divided into four independent modules: Database (Module 1), Backend API (Module 2), AI Engine (Module 3), Frontend UI (Module 4).
- Each module must be buildable, runnable, and testable in isolation without depending on another module being live.
- Frontend agents must use mock JSON data files stored in a `frontend/mock/` folder. These mock files must mirror the exact JSON structure returned by the real FastAPI endpoints.
- Backend agents must never hard-code frontend URLs or assume a specific frontend port.
- The AI Engine module must expose a single internal Python function `reconstruct_reasoning(log_data: dict) -> dict`. The backend calls this function. The function itself can be developed and tested independently using local test input files.
- All inter-module contracts (API request/response schemas) must be documented in a shared file: `docs/api_contracts.md`.
- No module should import code from another module's internal logic. Communication is only through HTTP API calls or clearly defined Python function signatures.

---

### Rule 3: Tech Stack Enforcement

- Frontend must be built using only vanilla HTML5, CSS3, and plain JavaScript (ES6+).
- Do not use React, Angular, Vue, Svelte, or any JavaScript component framework.
- Do not use Tailwind CSS, Bootstrap, or any CSS utility framework. All styles must be written in plain CSS files.
- Do not use jQuery. All DOM manipulation must use native browser APIs.
- JavaScript must be organized into separate `.js` files by feature. No inline `<script>` blocks containing logic longer than 5 lines.
- CSS must be organized into a base file (`base.css`), a layout file (`layout.css`), and component-specific files.
- All pages must be static `.html` files. No server-side templating on the frontend.
- Fonts must be loaded from Google Fonts via a `<link>` tag. Use Inter as the primary font.
- Icons must be loaded from Font Awesome CDN (free tier). Do not use icon libraries that require npm.

---

### Rule 4: API Communication

- All FastAPI endpoints must return JSON responses in the following standard envelope:

```json
{
  "status": "success" | "error",
  "message": "Human-readable description",
  "data": { } | [ ] | null
}
```

- HTTP status codes must be accurate: 200 for success, 201 for created, 400 for bad input, 401 for unauthorized, 404 for not found, 500 for server error.
- All endpoints must include CORS headers configured to allow requests from the frontend origin.
- All endpoints that require authentication must validate a JWT Bearer token from the `Authorization` header.
- All file upload endpoints must validate file type (CSV, PDF, XLSX only) and file size (max 10 MB) before processing.
- All LLM API calls must be wrapped in try/except blocks with a fallback error response. Never let an LLM API timeout crash the server.
- Endpoint response times must be under 2 seconds for non-AI endpoints. AI analysis endpoints may take up to 30 seconds and must return a task ID immediately, with results fetched via a polling endpoint.

---

### Rule 5: Code Style and Documentation

- All Python files must follow PEP 8 formatting. Use 4-space indentation.
- All Python functions must have docstrings explaining parameters and return values.
- All JavaScript functions must have JSDoc-style comments.
- All API routes must have inline comments explaining the purpose, expected input, and output.
- Sensitive values (API keys, database URLs, JWT secrets) must never be hard-coded. They must be stored in a `.env` file. A `.env.example` file must be committed to the repository with placeholder values.
- The `.env` file must be listed in `.gitignore`.
- Every module directory must contain a `README.md` explaining how to set up and run that module independently.

---

### Rule 6: Project Directory Structure

All agents must follow this exact directory layout:

```
CogniVault/
├── backend/
│   ├── main.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── uploads.py
│   │   ├── analysis.py
│   │   └── history.py
│   ├── services/
│   │   ├── ai_engine.py
│   │   ├── file_parser.py
│   │   └── preprocessor.py
│   ├── models/
│   │   └── schemas.py
│   ├── db/
│   │   └── supabase_client.py
│   ├── utils/
│   │   └── jwt_handler.py
│   ├── .env
│   ├── .env.example
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│   ├── uploads.html
│   ├── analysis.html
│   ├── history.html
│   ├── css/
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── sidebar.css
│   │   ├── dashboard.css
│   │   ├── uploads.css
│   │   ├── history.css
│   │   └── analysis.css
│   ├── js/
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── uploads.js
│   │   ├── analysis.js
│   │   └── history.js
│   ├── mock/
│   │   ├── dashboard.json
│   │   ├── history.json
│   │   └── analysis.json
│   └── assets/
│       └── logo.svg
├── docs/
│   ├── api_contracts.md
│   └── db_schema.sql
├── roadmap.md
└── README.md
```

---

## PART 2: Database Schema and Setup (Module 1)

### Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign in with a free account.
2. Click "New Project". Name it `cognivault`.
3. Set a strong database password and save it in your local `.env` file immediately.
4. Choose the free-tier region closest to your users.
5. Wait for the project to initialize (approximately 2 minutes).
6. Navigate to Settings > API. Copy the `Project URL` and `anon public` key. These go into `.env` as `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
7. Navigate to Settings > API. Copy the `service_role` key. This goes into `.env` as `SUPABASE_SERVICE_KEY`. Never expose this key on the frontend.

---

### Step 2: Create Database Tables

Open the Supabase SQL Editor and run the following SQL queries in order.

#### Table: users

```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Notes:
- `id` uses UUID instead of serial integer for security. UUIDs prevent enumeration attacks.
- `password_hash` stores the bcrypt hash of the password. The plain-text password is never stored.
- `email` has a UNIQUE constraint to prevent duplicate accounts.

#### Table: admin

```sql
CREATE TABLE IF NOT EXISTS admin (
    admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default admin. Replace the hash with a real bcrypt hash before deploying.
INSERT INTO admin (email, password_hash)
VALUES ('admin@cognivault.com', '$2b$12$PLACEHOLDER_HASH_REPLACE_THIS');
```

#### Table: user_uploads

```sql
CREATE TABLE IF NOT EXISTS user_uploads (
    upload_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) CHECK (file_type IN ('csv', 'pdf', 'xlsx')),
    file_size_bytes INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    upload_status VARCHAR(20) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed')),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Notes:
- `storage_path` stores the Supabase Storage bucket path, not a public URL.
- `ON DELETE CASCADE` ensures that deleting a user removes all their uploads automatically.

#### Table: ai_analyses

```sql
CREATE TABLE IF NOT EXISTS ai_analyses (
    analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES user_uploads(upload_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    confidence_score NUMERIC(5, 2),
    performance_metric NUMERIC(5, 2),
    reasoning_steps JSONB,
    consistency_flags JSONB,
    raw_llm_response TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);
```

Notes:
- `reasoning_steps` and `consistency_flags` are stored as JSONB for flexible querying.
- `confidence_score` and `performance_metric` are numeric values between 0.00 and 100.00.
- `raw_llm_response` stores the full LLM output for debugging and auditing.

#### Table: history

```sql
CREATE TABLE IF NOT EXISTS history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES user_uploads(upload_id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES ai_analyses(analysis_id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Notes:
- This table records every time a user views an analysis result. It acts as an audit trail.
- It uses foreign keys to both `user_uploads` and `ai_analyses`, which replaces the ambiguous `analysis_results (FK)` from the original spec.

---

### Step 3: Create Indexes for Performance

```sql
CREATE INDEX idx_user_uploads_user_id ON user_uploads(user_id);
CREATE INDEX idx_ai_analyses_user_id ON ai_analyses(user_id);
CREATE INDEX idx_ai_analyses_upload_id ON ai_analyses(upload_id);
CREATE INDEX idx_history_user_id ON history(user_id);
CREATE INDEX idx_history_viewed_at ON history(viewed_at DESC);
```

---

### Step 4: Configure Row Level Security (RLS)

RLS ensures users can only access their own data, even if someone obtains the anon key.

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

-- users: a user can only read and update their own row
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- user_uploads: a user can only see their own uploads
CREATE POLICY "Users can view own uploads"
    ON user_uploads FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uploads"
    ON user_uploads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploads"
    ON user_uploads FOR DELETE
    USING (auth.uid() = user_id);

-- ai_analyses: a user can only see their own analyses
CREATE POLICY "Users can view own analyses"
    ON ai_analyses FOR SELECT
    USING (auth.uid() = user_id);

-- history: a user can only see their own history
CREATE POLICY "Users can view own history"
    ON history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history"
    ON history FOR INSERT
    WITH CHECK (auth.uid() = user_id);
```

Important Note for Backend Agents: The FastAPI backend uses the `service_role` key (stored in `SUPABASE_SERVICE_KEY`) to bypass RLS when performing server-side operations. The RLS policies above apply when using the `anon` key. The backend must always use the service key and perform its own authorization checks (JWT validation) before any database operation.

---

### Step 5: Create Supabase Storage Bucket

1. In the Supabase dashboard, navigate to Storage.
2. Click "New Bucket". Name it `user-uploads`.
3. Set the bucket to Private (not public). Files must only be accessed via signed URLs.
4. Set the file size limit to 10 MB.
5. Allow the following MIME types: `text/csv`, `application/pdf`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

---

### Step 6: Environment Variables for Database

Add the following to `backend/.env`:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:your-db-password@db.your-project-ref.supabase.co:5432/postgres
```

Add the following to `backend/.env.example` (commit this file, not `.env`):

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

---

## PART 3: Backend API Development - FastAPI (Module 2)

### Step 1: Install Dependencies

Create backend/requirements.txt with the following content:

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
supabase==2.5.0
pydantic==2.7.0
pydantic-settings==2.2.1
python-dotenv==1.0.1
pandas==2.2.2
openpyxl==3.1.2
PyPDF2==3.0.1
httpx==0.27.0
```

Install with: pip install -r requirements.txt

---

### Step 2: Project Entry Point - main.py

File: backend/main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, uploads, analysis, history
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CogniVault API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace * with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["Uploads"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(history.router, prefix="/api/history", tags=["History"])

@app.get("/")
def root():
    return {"status": "success", "message": "CogniVault API is running", "data": None}
```

Run the server: uvicorn main:app --reload --port 8000

---

### Step 3: Supabase Client - db/supabase_client.py

```python
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def get_supabase() -> Client:
    """Return an authenticated Supabase client using the service role key."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)
```

---

### Step 4: Pydantic Schemas - models/schemas.py

```python
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    gender: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    name: str

class APIResponse(BaseModel):
    status: str
    message: str
    data: Optional[Any] = None

class AnalysisStatus(BaseModel):
    analysis_id: str
    status: str
    confidence_score: Optional[float] = None
    performance_metric: Optional[float] = None
    reasoning_steps: Optional[List[dict]] = None
    consistency_flags: Optional[List[dict]] = None
```

---

### Step 5: JWT Handler - utils/jwt_handler.py

```python
import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()

def create_access_token(user_id: str, email: str) -> str:
    """Create a signed JWT token for the given user."""
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Decode and verify the JWT. Raises 401 if invalid or expired."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return {"user_id": payload.get("sub"), "email": payload.get("email")}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
```

Add to backend/.env:
```
JWT_SECRET_KEY=a-very-long-random-secret-string-replace-this
```

---

### Step 6: Authentication Router - routers/auth.py

#### POST /api/auth/register

Purpose: Register a new user account.

Request body (JSON):
```json
{ "name": "Alice", "email": "alice@example.com", "password": "SecurePass123", "gender": "female" }
```

Validation rules:
- name: required, 2-100 characters
- email: must be valid email format, must not already exist in users table
- password: minimum 8 characters, must contain at least one uppercase letter and one digit
- gender: optional, must be one of: male, female, other, prefer_not_to_say

Logic:
1. Validate input with Pydantic UserRegister schema.
2. Query users table for existing email. If found, return 400 error "Email already registered."
3. Hash the password using passlib bcrypt: `pwd_context.hash(password)`.
4. Insert new row into users table with name, email, password_hash, gender.
5. Return 201 with the new user's id and name.

Success response:
```json
{ "status": "success", "message": "Account created successfully", "data": { "user_id": "uuid", "name": "Alice" } }
```

#### POST /api/auth/login

Purpose: Authenticate a user and return a JWT.

Request body (JSON):
```json
{ "email": "alice@example.com", "password": "SecurePass123" }
```

Logic:
1. Query users table by email. If not found, return 401 "Invalid email or password." (Do not reveal which field is wrong.)
2. Verify password against stored hash using `pwd_context.verify(password, stored_hash)`.
3. If verification fails, return 401 "Invalid email or password."
4. Call `create_access_token(user_id, email)` to generate JWT.
5. Return 200 with token and user info.

Success response:
```json
{ "status": "success", "message": "Login successful", "data": { "access_token": "eyJ...", "token_type": "bearer", "user_id": "uuid", "name": "Alice" } }
```

---

### Step 7: File Upload Router - routers/uploads.py

#### POST /api/uploads/upload

Purpose: Accept a file from the user, validate it, store it in Supabase Storage, and record the upload in the database.

Authentication: Required (JWT Bearer token).

Request: multipart/form-data with a single file field named `file`.

Logic:
1. Call `verify_token()` to get the current user_id.
2. Validate file extension: must be .csv, .pdf, or .xlsx. If not, return 400.
3. Validate file size: must be under 10 MB (10 * 1024 * 1024 bytes). If not, return 400.
4. Generate a unique storage path: `{user_id}/{timestamp}_{original_filename}`.
5. Upload the file bytes to Supabase Storage bucket `user-uploads` at the generated path.
6. Insert a row into user_uploads table with user_id, file_name, file_type, file_size_bytes, storage_path, upload_status='pending'.
7. Return 201 with the upload_id and storage_path.

Success response:
```json
{ "status": "success", "message": "File uploaded successfully", "data": { "upload_id": "uuid", "file_name": "activity_log.csv", "file_type": "csv" } }
```

#### GET /api/uploads/list

Purpose: List all files uploaded by the current user.

Authentication: Required.

Logic:
1. Verify JWT, get user_id.
2. Query user_uploads WHERE user_id = current user, ORDER BY uploaded_at DESC.
3. Return array of upload records.

Success response:
```json
{ "status": "success", "message": "Uploads retrieved", "data": [ { "upload_id": "uuid", "file_name": "log.csv", "file_type": "csv", "upload_status": "completed", "uploaded_at": "2024-01-15T10:30:00Z" } ] }
```

#### DELETE /api/uploads/{upload_id}

Purpose: Delete a specific upload and its associated storage file.

Authentication: Required. User can only delete their own uploads.

Logic:
1. Verify JWT, get user_id.
2. Query user_uploads by upload_id AND user_id to confirm ownership. If not found, return 404.
3. Delete the file from Supabase Storage using the stored storage_path.
4. Delete the row from user_uploads (CASCADE will remove associated analyses and history).
5. Return 200 success.

---

### Step 8: File Parser Service - services/file_parser.py

This service reads uploaded files and converts them to a unified list-of-dict format for the preprocessor.

```python
import io
import pandas as pd
import PyPDF2
from typing import List, Dict, Any

def parse_csv(file_bytes: bytes) -> List[Dict[str, Any]]:
    """Parse CSV bytes into a list of row dictionaries."""
    df = pd.read_csv(io.BytesIO(file_bytes))
    df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]
    return df.to_dict(orient="records")

def parse_xlsx(file_bytes: bytes) -> List[Dict[str, Any]]:
    """Parse Excel bytes into a list of row dictionaries."""
    df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
    df.columns = [col.strip().lower().replace(" ", "_") for col in df.columns]
    return df.to_dict(orient="records")

def parse_pdf(file_bytes: bytes) -> List[Dict[str, Any]]:
    """Extract text from PDF and return as a list with one entry per page."""
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        pages.append({"page": i + 1, "content": text.strip()})
    return pages

def parse_file(file_bytes: bytes, file_type: str) -> List[Dict[str, Any]]:
    """Route to the correct parser based on file_type."""
    if file_type == "csv":
        return parse_csv(file_bytes)
    elif file_type == "xlsx":
        return parse_xlsx(file_bytes)
    elif file_type == "pdf":
        return parse_pdf(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
```

---

### Step 9: Preprocessor Service - services/preprocessor.py

This service cleans and normalizes parsed data before it is sent to the AI engine.

```python
from typing import List, Dict, Any

def clean_log_data(raw_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Clean and normalize raw parsed rows.
    Returns a structured dict ready for the AI engine.
    """
    cleaned_entries = []
    for row in raw_rows:
        entry = {}
        for key, value in row.items():
            # Remove None values
            if value is None:
                continue
            # Strip whitespace from strings
            if isinstance(value, str):
                value = value.strip()
                if value == "":
                    continue
            entry[key] = value
        if entry:
            cleaned_entries.append(entry)

    return {
        "total_entries": len(cleaned_entries),
        "entries": cleaned_entries,
        "summary": {
            "fields": list(cleaned_entries[0].keys()) if cleaned_entries else [],
            "entry_count": len(cleaned_entries)
        }
    }
```

---

### Step 10: Analysis Router - routers/analysis.py

#### POST /api/analysis/start

Purpose: Trigger AI analysis for a specific upload_id. Returns immediately with an analysis_id. The analysis runs in the background.

Authentication: Required.

Request body:
```json
{ "upload_id": "uuid" }
```

Logic:
1. Verify JWT, get user_id.
2. Query user_uploads to confirm upload belongs to this user and status is 'completed'. If not found, return 404. If status is 'pending', return 400 "File is still uploading."
3. Create a new row in ai_analyses with status='queued', user_id, upload_id.
4. Launch background task: download file from Supabase Storage, parse, preprocess, send to AI engine.
5. Return 202 with analysis_id immediately.

Success response:
```json
{ "status": "success", "message": "Analysis started", "data": { "analysis_id": "uuid", "status": "queued" } }
```

#### GET /api/analysis/status/{analysis_id}

Purpose: Poll for the status and results of an analysis.

Authentication: Required.

Logic:
1. Verify JWT, get user_id.
2. Query ai_analyses by analysis_id AND user_id. If not found, return 404.
3. Return current status and results (if completed).

Success response when completed:
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

#### GET /api/analysis/list

Purpose: List all analyses for the current user.

Authentication: Required.

Returns: Array of analysis records ordered by created_at DESC.

---

## PART 4: AI Reasoning Reconstruction Engine (Module 3) - LangChain Implementation

### Step 1: Overview

File: backend/services/ai_engine.py

This module uses LangChain to orchestrate the full reasoning reconstruction pipeline. LangChain handles prompt templating, LLM invocation, and structured output parsing. The entry point is a single function `reconstruct_reasoning(log_data: dict) -> dict` which the FastAPI background task calls. The function is fully testable in isolation.

---

### Step 2: Install LangChain Dependencies

Add the following to backend/requirements.txt (replace or append to the existing AI section):

```
langchain==0.2.12
langchain-google-genai==1.0.7
langchain-groq==0.1.9
langchain-core==0.2.28
pydantic==2.7.0
```

Install: pip install -r requirements.txt

Add to backend/.env:
```
LLM_PROVIDER=gemini
GEMINI_API_KEY=your-google-ai-studio-api-key
GROQ_API_KEY=your-groq-api-key
```

To obtain Gemini API key: Visit https://aistudio.google.com/app/apikey (free, no credit card).
To obtain Groq API key: Visit https://console.groq.com (free tier, no credit card).

---

### Step 3: Pydantic Output Schema

This schema is the strict contract between the LangChain output parser and the FastAPI backend. The frontend reads this exact structure from the database.

Define inside backend/services/ai_engine.py:

```python
from pydantic import BaseModel, Field
from typing import List

class ReasoningStep(BaseModel):
    """A single reconstructed reasoning step."""
    step_number: int = Field(description="Sequential step index starting at 1.")
    step_type: str = Field(description="Either 'observable' or 'inferred'.")
    description: str = Field(description="Plain English description of this reasoning step.")
    evidence: str = Field(description="Evidence from the log data that supports this step.")
    confidence: int = Field(ge=0, le=100, description="Confidence score for this step, 0 to 100.")

class ConsistencyFlag(BaseModel):
    """A detected inconsistency in the reasoning trace."""
    flag_id: int = Field(description="Sequential flag index starting at 1.")
    severity: str = Field(description="One of: low, medium, high.")
    description: str = Field(description="Description of the inconsistency.")
    related_steps: List[int] = Field(description="Step numbers involved in this inconsistency.")

class CognitiveTraceAnalysis(BaseModel):
    """
    The complete structured output from the AI reasoning reconstruction engine.
    This is the schema the LangChain PydanticOutputParser enforces.
    All fields are required. The FastAPI route stores this in the ai_analyses table.
    """
    confidence_score: int = Field(
        ge=0, le=100,
        description="Overall confidence score for the entire reconstruction, 0 to 100."
    )
    reconstructed_steps: List[str] = Field(
        description="Ordered list of plain English strings describing each inferred thought process step. Each string must be a complete sentence."
    )
    detected_patterns: List[str] = Field(
        description="List of behavioral pattern strings observed across the log data. Each string must be a complete sentence."
    )
    reasoning_steps: List[ReasoningStep] = Field(
        description="Detailed step objects with evidence and per-step confidence scores."
    )
    consistency_flags: List[ConsistencyFlag] = Field(
        default=[],
        description="List of detected inconsistencies. Empty list if none found."
    )
    summary: str = Field(
        description="2 to 3 sentence plain English summary of the overall reconstruction."
    )
    performance_metric: int = Field(
        ge=0, le=100,
        description="Coherence and completeness score for the reasoning trace, 0 to 100."
    )
```

Note on the frontend-required fields: The frontend reads `confidence_score` (integer 0-100), `reconstructed_steps` (list of strings), and `detected_patterns` (list of strings) as primary display fields. All other fields are secondary detail fields. The schema must always include all of them.

---

### Step 4: LLM Instantiation

Define a factory function that returns the correct LangChain chat model based on the LLM_PROVIDER environment variable. Both models implement the same LangChain `BaseChatModel` interface, so the rest of the chain is provider-agnostic.

```python
import os
from langchain_core.language_models import BaseChatModel

def get_llm() -> BaseChatModel:
    """
    Initialize and return the appropriate LangChain LLM based on LLM_PROVIDER env var.
    Returns ChatGoogleGenerativeAI for 'gemini' or ChatGroq for 'groq'.
    Raises EnvironmentError if required API key is missing.
    """
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()

    if provider == "groq":
        from langchain_groq import ChatGroq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise EnvironmentError("GROQ_API_KEY is not set in environment variables.")
        return ChatGroq(
            model="llama3-70b-8192",
            api_key=api_key,
            temperature=0.2,
            max_tokens=4096,
        )
    else:
        from langchain_google_genai import ChatGoogleGenerativeAI
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise EnvironmentError("GEMINI_API_KEY is not set in environment variables.")
        return ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=api_key,
            temperature=0.2,
            max_output_tokens=4096,
        )
```

---

### Step 5: Prompt Templates

Two PromptTemplate objects are defined: one for behavioral extraction and one for reasoning inference. They are composed into a single system message using LangChain's ChatPromptTemplate.

#### Behavioral Extraction Prompt Template

Purpose: Instruct the LLM to identify observable behavioral patterns from the raw log data before attempting inference.

```python
from langchain_core.prompts import PromptTemplate

BEHAVIORAL_EXTRACTION_TEMPLATE = PromptTemplate.from_template(
    """You are CogniTrace, an expert behavioral analyst.

Analyze the following raw log data and extract all observable behavioral patterns.

Log Data (up to 50 entries shown):
{log_entries}

Fields present in this log: {log_fields}
Total entries in the full log: {total_entries}

Your task:
1. Identify repeated actions or sequences.
2. Identify time gaps that suggest periods of deliberation.
3. Identify corrections, edits, or reversals.
4. Identify progression patterns (does the user move forward consistently or backtrack?).
5. Identify any anomalies (sudden jumps, missing steps, out-of-order actions).

Summarize your findings as a numbered list of behavioral patterns. Be specific and cite evidence from the log data. Do not infer reasoning yet - only describe what is directly observable."""
)
```

#### Reasoning Inference Prompt Template

Purpose: Instruct the LLM to reconstruct the hidden reasoning steps from the behavioral patterns extracted in the previous step. This template takes the output of the behavioral extraction as input.

```python
REASONING_INFERENCE_TEMPLATE = PromptTemplate.from_template(
    """You are CogniTrace, an expert cognitive analyst specializing in reasoning reconstruction.

You have already extracted the following behavioral patterns from a user's activity log:

{behavioral_patterns}

Original log summary:
- Total entries: {total_entries}
- Fields present: {log_fields}

Now reconstruct the user's hidden step-by-step reasoning process. For each reconstructed step:
- Determine if it is directly observable in the log or must be inferred.
- Provide the evidence or reasoning that supports your inference.
- Assign a confidence score (0-100) to each step.

Also:
- Assign an overall confidence score to the entire reconstruction.
- Assign a performance metric (0-100) measuring coherence and completeness.
- Identify any internal consistency violations (where later actions contradict earlier reasoning).
- Write a 2-3 sentence summary of the overall reconstruction.

{format_instructions}"""
)
```

Note: `{format_instructions}` is injected automatically by the PydanticOutputParser at runtime. It contains the exact JSON schema the LLM must follow.

---

### Step 6: Output Parser

Use LangChain's `PydanticOutputParser` with the `CognitiveTraceAnalysis` schema defined in Step 3.

```python
from langchain_core.output_parsers import PydanticOutputParser

def get_output_parser() -> PydanticOutputParser:
    """
    Return a PydanticOutputParser configured for CognitiveTraceAnalysis.
    The parser validates the LLM's JSON output against the schema and
    raises OutputParserException if the output does not conform.
    """
    return PydanticOutputParser(pydantic_object=CognitiveTraceAnalysis)
```

The `PydanticOutputParser` does three things automatically:
1. Generates `format_instructions` text that is injected into the prompt, telling the LLM exactly what JSON structure to return.
2. Parses the raw LLM string output into a validated `CognitiveTraceAnalysis` Pydantic object.
3. Raises `langchain_core.exceptions.OutputParserException` if the LLM output does not conform to the schema.

---

### Step 7: LCEL Chain Definition

LangChain Expression Language (LCEL) uses the pipe operator `|` to compose components into a chain. The chain flows: raw data -> behavioral extraction prompt -> LLM -> behavioral pattern text -> reasoning inference prompt -> LLM -> output parser -> validated Pydantic object.

```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, PydanticOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
import json

def build_cognitive_trace_chain():
    """
    Build and return the full two-stage LCEL chain for reasoning reconstruction.

    Stage 1: Behavioral extraction chain
        Input:  dict with keys log_entries, log_fields, total_entries
        Output: string of extracted behavioral patterns

    Stage 2: Reasoning inference chain
        Input:  dict with keys behavioral_patterns, log_fields, total_entries, format_instructions
        Output: validated CognitiveTraceAnalysis Pydantic object

    Returns a single RunnableSequence that accepts the input dict and
    returns a CognitiveTraceAnalysis instance.
    """
    llm = get_llm()
    output_parser = get_output_parser()

    # Stage 1: Behavioral Extraction Chain
    # Pipes log data into the extraction prompt, then to LLM, then extracts plain text output.
    extraction_chain = (
        BEHAVIORAL_EXTRACTION_TEMPLATE
        | llm
        | StrOutputParser()
    )

    # Stage 2: Reasoning Inference Chain
    # Takes behavioral_patterns from stage 1 plus original log metadata.
    # Injects format_instructions from the PydanticOutputParser into the prompt.
    inference_prompt = ChatPromptTemplate.from_messages([
        ("human", REASONING_INFERENCE_TEMPLATE.template)
    ])

    inference_chain = (
        inference_prompt
        | llm
        | output_parser
    )

    # Full two-stage chain using LCEL composition:
    # 1. Run extraction_chain on the input to get behavioral_patterns string.
    # 2. Merge behavioral_patterns with original input keys and format_instructions.
    # 3. Run inference_chain on the merged dict.
    full_chain = (
        RunnablePassthrough.assign(
            behavioral_patterns=extraction_chain
        )
        | RunnableLambda(lambda x: {
            "behavioral_patterns": x["behavioral_patterns"],
            "log_fields": x["log_fields"],
            "total_entries": x["total_entries"],
            "format_instructions": output_parser.get_format_instructions()
        })
        | inference_chain
    )

    return full_chain
```

---

### Step 8: Main Entry Point Function

This is the function called by the FastAPI background task. It prepares the input, invokes the chain, handles errors, and returns a plain dict (not a Pydantic object) for storage in the database.

```python
from langchain_core.exceptions import OutputParserException
from typing import Dict, Any
import json

def reconstruct_reasoning(log_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main entry point for the AI reasoning reconstruction engine.

    Parameters:
        log_data (dict): Cleaned log data from the preprocessor service.
                         Must contain keys: 'entries' (list), 'total_entries' (int),
                         'summary' (dict with 'fields' list).

    Returns:
        dict: A plain dictionary matching the CognitiveTraceAnalysis schema,
              ready for storage in the ai_analyses table JSONB columns.

    Raises:
        ValueError: If the LLM returns output that cannot be parsed into the schema.
        RuntimeError: If the LLM API call fails due to network or rate limit errors.
    """
    # Prepare input for the chain
    entries = log_data.get("entries", [])[:50]  # Cap at 50 entries to stay within token limits
    log_fields = ", ".join(log_data.get("summary", {}).get("fields", []))
    total_entries = log_data.get("total_entries", 0)
    log_entries_json = json.dumps(entries, indent=2)

    chain_input = {
        "log_entries": log_entries_json,
        "log_fields": log_fields,
        "total_entries": total_entries,
    }

    try:
        chain = build_cognitive_trace_chain()
        result: CognitiveTraceAnalysis = chain.invoke(chain_input)

        # Convert Pydantic model to plain dict for JSON serialization and DB storage
        return result.model_dump()

    except OutputParserException as e:
        raise ValueError(
            f"LLM returned output that does not conform to the required schema. "
            f"Parser error: {str(e)}"
        )
    except Exception as e:
        error_msg = str(e)
        # Detect common rate limit errors and provide a clear message
        if "rate" in error_msg.lower() or "quota" in error_msg.lower() or "429" in error_msg:
            raise RuntimeError(
                f"LLM API rate limit reached. Please wait and retry. Details: {error_msg}"
            )
        raise RuntimeError(f"LLM API call failed: {error_msg}")
```

---

### Step 9: Expected Output Structure

After `reconstruct_reasoning()` returns `result.model_dump()`, the FastAPI background task receives a dict with this exact structure. The backend stores it in the JSONB columns of the ai_analyses table.

```json
{
  "confidence_score": 85,
  "reconstructed_steps": [
    "The user first reviewed the initial data to establish a baseline understanding.",
    "The user compared two competing approaches before committing to the first.",
    "After a 12-minute pause, the user reversed their earlier decision, suggesting new information was internally processed.",
    "The user systematically validated their final answer against earlier observations."
  ],
  "detected_patterns": [
    "Exploratory reasoning style: the user frequently revisits earlier steps before progressing.",
    "High self-correction rate: 4 edits in 10 entries suggests iterative rather than linear thinking.",
    "Deliberation gaps: 3 pauses exceeding 5 minutes indicate deep internal processing before key decisions."
  ],
  "reasoning_steps": [
    {
      "step_number": 1,
      "step_type": "observable",
      "description": "User reviewed initial data entries without making changes.",
      "evidence": "First 3 log entries show read-only access with timestamps 2 minutes apart.",
      "confidence": 95
    },
    {
      "step_number": 2,
      "step_type": "inferred",
      "description": "User internally weighed two competing hypotheses.",
      "evidence": "12-minute gap followed by a major answer change in entry 7.",
      "confidence": 71
    }
  ],
  "consistency_flags": [
    {
      "flag_id": 1,
      "severity": "medium",
      "description": "The conclusion in step 4 contradicts the intermediate decision made in step 2.",
      "related_steps": [2, 4]
    }
  ],
  "summary": "The user demonstrated an exploratory reasoning pattern with high self-correction frequency. The overall reconstruction confidence is moderate due to several inferred steps with limited direct evidence. One medium-severity consistency issue was detected between early and late reasoning stages.",
  "performance_metric": 80
}
```

Note for frontend agents: The primary display fields are `confidence_score`, `reconstructed_steps`, and `detected_patterns`. These map directly to the Score Summary, Reasoning Steps Timeline, and Behavioral Patterns sections of analysis.html. The `reasoning_steps` array provides the detailed timeline data.

---

### Step 10: Retry Logic and Rate Limit Handling

Wrap the chain invocation with exponential backoff to handle Gemini and Groq free-tier rate limits gracefully.

```python
import time

def reconstruct_reasoning_with_retry(log_data: Dict[str, Any], max_retries: int = 3) -> Dict[str, Any]:
    """
    Wrapper around reconstruct_reasoning that retries on rate limit errors.

    Parameters:
        log_data (dict): Cleaned log data.
        max_retries (int): Maximum number of retry attempts. Default is 3.

    Returns:
        dict: Analysis result dict on success.

    Raises:
        RuntimeError: If all retries are exhausted.
    """
    for attempt in range(1, max_retries + 1):
        try:
            return reconstruct_reasoning(log_data)
        except RuntimeError as e:
            if "rate limit" in str(e).lower() and attempt < max_retries:
                wait_seconds = 2 ** attempt  # Exponential backoff: 2s, 4s, 8s
                time.sleep(wait_seconds)
                continue
            raise
```

The FastAPI background task must call `reconstruct_reasoning_with_retry(clean_data)` instead of `reconstruct_reasoning(clean_data)` directly.

---

### Step 11: Testing the Engine in Isolation

Before integrating with FastAPI, test the engine independently using a local test script.

Create: backend/tests/test_ai_engine.py

```python
"""
Standalone test for the AI reasoning reconstruction engine.
Run this script directly: python tests/test_ai_engine.py
No FastAPI server or database required.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from services.ai_engine import reconstruct_reasoning_with_retry

# Sample mock log data matching the structure produced by the preprocessor
MOCK_LOG_DATA = {
    "total_entries": 10,
    "summary": {
        "fields": ["timestamp", "action", "target", "value", "duration_seconds"],
        "entry_count": 10
    },
    "entries": [
        {"timestamp": "2024-01-15T09:00:00", "action": "view", "target": "question_1", "value": None, "duration_seconds": 45},
        {"timestamp": "2024-01-15T09:00:50", "action": "view", "target": "question_2", "value": None, "duration_seconds": 30},
        {"timestamp": "2024-01-15T09:01:30", "action": "answer", "target": "question_1", "value": "Option A", "duration_seconds": 20},
        {"timestamp": "2024-01-15T09:02:00", "action": "edit", "target": "question_1", "value": "Option C", "duration_seconds": 10},
        {"timestamp": "2024-01-15T09:14:15", "action": "answer", "target": "question_3", "value": "Option B", "duration_seconds": 35},
        {"timestamp": "2024-01-15T09:15:00", "action": "review", "target": "question_1", "value": None, "duration_seconds": 60},
        {"timestamp": "2024-01-15T09:16:10", "action": "edit", "target": "question_1", "value": "Option A", "duration_seconds": 5},
        {"timestamp": "2024-01-15T09:16:20", "action": "submit", "target": "all", "value": None, "duration_seconds": 2},
    ]
}

if __name__ == "__main__":
    print("Running AI Engine test with mock log data...")
    try:
        result = reconstruct_reasoning_with_retry(MOCK_LOG_DATA)
        print("SUCCESS. Result keys:", list(result.keys()))
        print(f"Confidence Score: {result['confidence_score']}")
        print(f"Reconstructed Steps ({len(result['reconstructed_steps'])}):")
        for step in result['reconstructed_steps']:
            print(f"  - {step}")
        print(f"Detected Patterns ({len(result['detected_patterns'])}):")
        for pattern in result['detected_patterns']:
            print(f"  - {pattern}")
        print(f"Consistency Flags: {len(result['consistency_flags'])}")
        print(f"Performance Metric: {result['performance_metric']}")
    except Exception as e:
        print(f"FAILED: {e}")
        sys.exit(1)
```

Run the test: python backend/tests/test_ai_engine.py

Expected output confirms the engine returns a valid dict with all required fields.

## PART 5: Frontend Interface Development (Module 4)

### Step 1: Design System and Base CSS

File: frontend/css/base.css

Define all CSS custom properties (variables) here. Every other CSS file imports or inherits these.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  /* Color Palette */
  --color-bg-primary: #0d1117;
  --color-bg-secondary: #161b22;
  --color-bg-card: #1c2128;
  --color-border: #30363d;
  --color-accent: #7c3aed;
  --color-accent-hover: #6d28d9;
  --color-accent-light: rgba(124, 58, 237, 0.15);
  --color-text-primary: #e6edf3;
  --color-text-secondary: #8b949e;
  --color-text-muted: #6e7681;
  --color-success: #3fb950;
  --color-warning: #d29922;
  --color-error: #f85149;
  --color-info: #58a6ff;

  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.5);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.6);
  --shadow-accent: 0 0 20px rgba(124, 58, 237, 0.3);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { font-size: 16px; scroll-behavior: smooth; }

body {
  font-family: var(--font-family);
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  line-height: 1.6;
  min-height: 100vh;
}

a { color: var(--color-accent); text-decoration: none; transition: color var(--transition-fast); }
a:hover { color: var(--color-accent-hover); }

button {
  cursor: pointer;
  font-family: var(--font-family);
  border: none;
  outline: none;
  transition: all var(--transition-base);
}

input, select, textarea {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  padding: var(--space-3) var(--space-4);
  width: 100%;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-light);
}

.btn-primary {
  background: var(--color-accent);
  color: #fff;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 600;
  letter-spacing: 0.02em;
}
.btn-primary:hover { background: var(--color-accent-hover); transform: translateY(-1px); box-shadow: var(--shadow-accent); }
.btn-primary:active { transform: translateY(0); }

.btn-secondary {
  background: transparent;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  font-weight: 500;
}
.btn-secondary:hover { border-color: var(--color-accent); color: var(--color-accent); }

.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: 20px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge-success { background: rgba(63,185,80,0.15); color: var(--color-success); }
.badge-warning { background: rgba(210,153,34,0.15); color: var(--color-warning); }
.badge-error { background: rgba(248,81,73,0.15); color: var(--color-error); }
.badge-info { background: rgba(88,166,255,0.15); color: var(--color-info); }

.form-group { display: flex; flex-direction: column; gap: var(--space-2); }
.form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--color-text-secondary); }
.form-error { font-size: var(--font-size-xs); color: var(--color-error); display: none; }
.form-error.visible { display: block; }

.spinner {
  width: 24px; height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

---

### Step 2: Layout CSS - Sidebar and Main Content

File: frontend/css/layout.css

```css
.app-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.sidebar {
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: var(--space-6) 0;
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 240px;
  z-index: 100;
  overflow-y: auto;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-6) var(--space-6);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-4);
}

.sidebar-logo-icon {
  width: 36px; height: 36px;
  background: var(--color-accent);
  border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: var(--font-size-lg);
}

.sidebar-logo-text { font-size: var(--font-size-lg); font-weight: 700; }

.sidebar-nav { flex: 1; padding: 0 var(--space-3); }

.nav-item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  margin-bottom: var(--space-1);
  transition: all var(--transition-fast);
  cursor: pointer;
}
.nav-item:hover { background: var(--color-accent-light); color: var(--color-text-primary); }
.nav-item.active { background: var(--color-accent-light); color: var(--color-accent); border-left: 3px solid var(--color-accent); }
.nav-item i { width: 18px; text-align: center; }

.sidebar-footer {
  padding: var(--space-4) var(--space-3);
  border-top: 1px solid var(--color-border);
}

.sidebar-user {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
}

.sidebar-user-avatar {
  width: 34px; height: 34px;
  background: var(--color-accent);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: var(--font-size-sm); font-weight: 700; color: #fff;
}

.sidebar-user-name { font-size: var(--font-size-sm); font-weight: 600; }
.sidebar-user-email { font-size: var(--font-size-xs); color: var(--color-text-muted); }

.main-content {
  margin-left: 240px;
  padding: var(--space-8);
  min-height: 100vh;
}

.page-header {
  margin-bottom: var(--space-8);
}
.page-title { font-size: var(--font-size-2xl); font-weight: 700; }
.page-subtitle { color: var(--color-text-secondary); margin-top: var(--space-1); }

@media (max-width: 768px) {
  .app-layout { grid-template-columns: 1fr; }
  .sidebar { transform: translateX(-100%); transition: transform var(--transition-base); }
  .sidebar.open { transform: translateX(0); }
  .main-content { margin-left: 0; padding: var(--space-4); }
}
```

---

### Step 3: Login and Registration Pages

File: frontend/login.html

HTML structure:
- Page title: "CogniVault - Sign In"
- Meta description: "Sign in to your CogniVault account to analyze your cognitive traces."
- Centered card layout (max-width 420px, vertically centered on screen).
- Logo and app name at the top of the card.
- Form with fields: email (type=email, id=login-email), password (type=password, id=login-password).
- Show/hide password toggle button using Font Awesome eye icon.
- Submit button: id=login-btn, text="Sign In".
- Error message div: id=login-error, hidden by default.
- Link below form: "Don't have an account? Register here" linking to register.html.

Form validation rules (in js/auth.js):
- Email: must not be empty, must match regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/.
- Password: must not be empty, minimum 1 character (server-side handles complexity).
- On validation failure: add red border to field, show error message below field.
- On submit: disable button, show spinner inside button, call POST /api/auth/login.
- On success: store access_token, user_id, name in localStorage. Redirect to dashboard.html.
- On error: re-enable button, show server error message in login-error div.

File: frontend/register.html

HTML structure:
- Page title: "CogniVault - Create Account"
- Same centered card layout.
- Form with fields: name (id=reg-name), email (id=reg-email), password (id=reg-password), confirm password (id=reg-confirm-password), gender select (id=reg-gender) with options: male, female, other, prefer_not_to_say.
- Submit button: id=register-btn.
- Error div: id=reg-error.
- Link: "Already have an account? Sign in" to login.html.

Validation rules:
- name: required, 2-100 characters, no numbers.
- email: valid format, checked on blur (not on every keystroke).
- password: minimum 8 characters, at least one uppercase letter, at least one digit.
- confirm password: must exactly match password field.
- All validation errors shown inline below each field.
- On submit: call POST /api/auth/register. On success redirect to login.html with a query param ?registered=1 which triggers a success message banner.

---

### Step 4: Dashboard Page

File: frontend/dashboard.html

Layout: app-layout grid (sidebar + main-content).

Sidebar nav items:
- Home (active) - link to dashboard.html - icon: fa-home
- Uploads - link to uploads.html - icon: fa-upload
- Analysis - link to analysis.html - icon: fa-brain
- History - link to history.html - icon: fa-history
- Logout - id=logout-btn - icon: fa-sign-out-alt

Main content sections:

Section 1 - Stats Grid (id=stats-grid):
Four stat cards in a 2x2 or 4-column row:
- Total Uploads: id=stat-total-uploads, icon: fa-file-upload
- Total Analyses: id=stat-total-analyses, icon: fa-brain
- Average Performance Score: id=stat-avg-score, displayed as "82/100", icon: fa-chart-line
- Consistency Rate: id=stat-consistency, displayed as percentage, icon: fa-check-circle

Each stat card has: icon, large number, label underneath, and a subtle colored border on the left matching the stat type.

Section 2 - Performance Chart (id=chart-section):
Card containing a canvas element: id=performance-chart, height 280px.
Use Chart.js loaded from CDN: https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js
Chart type: Line chart showing last 7 analyses performance_metric scores.
X-axis: dates of analyses. Y-axis: 0-100.
Line color: var(--color-accent) (#7c3aed).
Fill: gradient from accent to transparent.
No chart.js dependency should be bundled, use CDN only.

Section 3 - Recent Files (id=recent-files):
Card with heading "Recent Uploads".
List of last 5 uploads showing: file name, file type badge, upload date, upload status badge.
Each item has a "Analyze" button that links to analysis.html?upload_id={id}.

JavaScript (js/dashboard.js):
- On page load: check localStorage for access_token. If missing, redirect to login.html.
- Call GET /api/uploads/list and GET /api/analysis/list.
- Populate stat cards with calculated values.
- Build Chart.js line chart from analysis data.
- Render recent files list.
- Logout button: clear localStorage, redirect to login.html.
- In mock mode: load from frontend/mock/dashboard.json instead of API.

Mock data file: frontend/mock/dashboard.json
```json
{
  "stats": { "total_uploads": 12, "total_analyses": 9, "avg_performance": 82, "consistency_rate": 76 },
  "recent_uploads": [
    { "upload_id": "uuid1", "file_name": "session_log_jan.csv", "file_type": "csv", "upload_status": "completed", "uploaded_at": "2024-01-15T10:30:00Z" },
    { "upload_id": "uuid2", "file_name": "exam_trace.pdf", "file_type": "pdf", "upload_status": "completed", "uploaded_at": "2024-01-14T08:20:00Z" }
  ],
  "performance_history": [
    { "date": "2024-01-09", "score": 65 },
    { "date": "2024-01-10", "score": 70 },
    { "date": "2024-01-11", "score": 78 },
    { "date": "2024-01-12", "score": 74 },
    { "date": "2024-01-13", "score": 82 },
    { "date": "2024-01-14", "score": 79 },
    { "date": "2024-01-15", "score": 87 }
  ]
}
```

---

### Step 5: Uploads Page

File: frontend/uploads.html

Layout: app-layout with sidebar.

Main content:

Section 1 - Upload Area (id=upload-section):
Card with:
- Drag-and-drop zone: id=drop-zone, large bordered dashed area, center-aligned content.
  - Icon: fa-cloud-upload-alt (large, 48px).
  - Text: "Drag and drop your file here".
  - Sub-text: "Supported formats: CSV, PDF, XLSX. Max size: 10 MB".
  - Button inside: id=browse-btn, text="Browse Files", btn-secondary style.
  - Hidden file input: id=file-input, accept=".csv,.pdf,.xlsx", multiple=false.
- Below the drop zone: id=selected-file-info, hidden, shows selected file name and size.
- Upload button: id=upload-btn, text="Upload and Analyze", btn-primary, disabled by default.
- Progress bar: id=upload-progress, hidden, shows during upload.
- Status message: id=upload-status, shows success or error after upload.

Drag-and-drop JavaScript logic (in js/uploads.js):
- Add dragover listener to drop-zone: prevent default, add 'drag-active' CSS class.
- Add dragleave listener: remove 'drag-active' class.
- Add drop listener: prevent default, remove 'drag-active', extract file from event.dataTransfer.files[0].
- Add change listener to file-input: extract file from event.target.files[0].
- On file selection: validate type and size client-side. Show error if invalid. If valid, show file info and enable upload-btn.
- On upload-btn click: create FormData, append file, call POST /api/uploads/upload with Authorization header.
- Show progress via XMLHttpRequest onprogress event (not fetch, since fetch does not support upload progress).
- On success: show success message, optionally redirect to analysis.html?upload_id={id}.

Section 2 - Uploaded Files List (id=uploads-list):
Card below the upload area listing all existing uploads (same data as dashboard recent files but complete list).
Each row: file name, type badge, size, date, status badge, Delete button (id=delete-btn-{upload_id}).

---

### Step 6: Analysis Page

File: frontend/analysis.html

Purpose: Shows the detailed result of one AI analysis.

URL parameter: ?analysis_id={id} OR ?upload_id={id} (triggers new analysis).

If upload_id param is present and no analysis_id:
- On load: call POST /api/analysis/start with upload_id.
- Show loading state: large spinner with text "Reconstructing reasoning trace...".
- Begin polling GET /api/analysis/status/{analysis_id} every 3 seconds.
- Show estimated wait time: "This may take up to 30 seconds."
- On completion: render results (see below).
- On failure: show error message with retry button.

Results layout (rendered after analysis completes):

Section 1 - Score Summary (id=score-summary):
Two large score circles side by side:
- Confidence Score: id=confidence-score, circular progress indicator showing the score (e.g., 87.5).
- Performance Metric: id=performance-metric, same style (e.g., 82.0).
Below: summary text paragraph (from AI result summary field).

Section 2 - Reasoning Steps Timeline (id=steps-timeline):
Vertical timeline of all reasoning steps.
Each step card shows:
- Step number (circle badge).
- Step type badge: "Observable" (green) or "Inferred" (purple).
- Description text.
- Evidence text (smaller, muted color).
- Confidence bar (mini progress bar 0-100%).

Section 3 - Consistency Flags (id=consistency-flags):
If no flags: show "No consistency issues detected" with a green checkmark.
If flags present: list each flag as an alert-style card.
Each flag shows: severity badge, description, and which step numbers are related.

Section 4 - Behavioral Patterns (id=behavioral-patterns):
Unordered list of behavioral pattern strings returned by the AI.

---

### Step 7: History Page

File: frontend/history.html

Layout: app-layout with sidebar.

Main content:

Section 1 - Filter Bar:
Row with: search input (id=history-search, placeholder="Search by file name"), date range picker (two date inputs: id=date-from, id=date-to), filter button.

Section 2 - History Table (id=history-table):
Table with columns: SNO, File Name (hyperlink to analysis.html?analysis_id={id}), File Type, Analysis Date, Confidence Score, Performance Score, Actions.

Table styling:
- Alternating row background colors.
- Sticky header.
- Sortable columns (click header to sort ascending/descending).
- Pagination: 10 rows per page. Pagination controls below table.

Empty state: if no history, show centered illustration with text "No analysis history yet. Upload a file to get started."

JavaScript (js/history.js):
- On load: verify token, call GET /api/history/list.
- Render table rows.
- Implement client-side filtering by search text and date range.
- Implement client-side sorting.
- Implement pagination.

Mock file: frontend/mock/history.json
```json
{
  "history": [
    {
      "history_id": "h1",
      "file_name": "session_log_jan.csv",
      "file_type": "csv",
      "analysis_id": "a1",
      "confidence_score": 87.5,
      "performance_metric": 82.0,
      "viewed_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## PART 6: End-to-End Integration and Testing (Module 5)

### Step 1: Central API Client - js/api.js

This file is the single point of contact between the frontend and the backend. All pages import this file. No other JS file should directly call fetch().

```javascript
/**
 * CogniVault API Client
 * All API communication goes through this module.
 */

const API_BASE_URL = 'http://localhost:8000/api';
const MOCK_MODE = false; // Set to true to use mock JSON data during development

/**
 * Get the stored JWT token from localStorage.
 * @returns {string|null} The token or null if not logged in.
 */
function getToken() {
  return localStorage.getItem('cv_access_token');
}

/**
 * Store authentication data after login.
 * @param {string} token - JWT access token.
 * @param {string} userId - User UUID.
 * @param {string} name - User display name.
 */
function storeAuth(token, userId, name) {
  localStorage.setItem('cv_access_token', token);
  localStorage.setItem('cv_user_id', userId);
  localStorage.setItem('cv_user_name', name);
}

/**
 * Clear all authentication data and redirect to login.
 */
function logout() {
  localStorage.removeItem('cv_access_token');
  localStorage.removeItem('cv_user_id');
  localStorage.removeItem('cv_user_name');
  window.location.href = '/login.html';
}

/**
 * Check if user is logged in. Redirect to login if not.
 */
function requireAuth() {
  if (!getToken()) {
    window.location.href = '/login.html';
  }
}

/**
 * Core fetch wrapper. Handles auth headers, JSON parsing, and error normalization.
 * @param {string} endpoint - API path, e.g. '/auth/login'.
 * @param {object} options - Fetch options (method, body, etc.).
 * @returns {Promise<object>} The parsed JSON data field from the standard envelope.
 */
async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  const json = await response.json();

  if (!response.ok || json.status === 'error') {
    throw new Error(json.message || 'An unexpected error occurred.');
  }
  return json.data;
}

/**
 * Upload a file using XMLHttpRequest to track upload progress.
 * @param {File} file - The file object to upload.
 * @param {function} onProgress - Callback receiving percent (0-100).
 * @returns {Promise<object>} The data field from the API response.
 */
function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/uploads/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && json.status === 'success') {
          resolve(json.data);
        } else {
          reject(new Error(json.message || 'Upload failed.'));
        }
      } catch {
        reject(new Error('Invalid response from server.'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.send(formData);
  });
}

// Export functions for use in other modules
window.CogniAPI = { apiRequest, uploadFile, storeAuth, logout, requireAuth, getToken };
```

---

### Step 2: How to Load Mock Data vs Real API

In each page-specific JS file (dashboard.js, history.js, etc.), use this pattern:

```javascript
async function loadDashboardData() {
  if (window.CogniAPI && MOCK_MODE) {
    // Load from local mock file
    const response = await fetch('/mock/dashboard.json');
    return await response.json();
  }
  // Load from real API
  const uploads = await CogniAPI.apiRequest('/uploads/list');
  const analyses = await CogniAPI.apiRequest('/analysis/list');
  return buildDashboardPayload(uploads, analyses);
}
```

MOCK_MODE must be a constant defined in api.js. Frontend agents set it to true. Integration agents set it to false.

---

### Step 3: Loading State Pattern

Every API call that updates the UI must follow this exact pattern to handle loading states:

```javascript
/**
 * Show a loading skeleton or spinner in a container.
 * @param {string} containerId - The id of the element to show loading state in.
 */
function showLoading(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>';
}

/**
 * Show an error message in a container.
 * @param {string} containerId - The id of the element.
 * @param {string} message - The error message.
 */
function showError(containerId, message) {
  const el = document.getElementById(containerId);
  el.innerHTML = `<div class="error-container"><i class="fas fa-exclamation-triangle"></i><p>${message}</p><button onclick="location.reload()">Retry</button></div>`;
}

// Usage pattern in every page:
async function initPage() {
  CogniAPI.requireAuth();
  showLoading('main-content-area');
  try {
    const data = await loadPageData();
    renderPage(data);
  } catch (error) {
    showError('main-content-area', error.message);
  }
}

document.addEventListener('DOMContentLoaded', initPage);
```

---

### Step 4: Displaying Reconstructed Reasoning Steps

In js/analysis.js, the `renderReasoningSteps(steps)` function:

```javascript
/**
 * Render the reasoning steps timeline into the DOM.
 * @param {Array} steps - Array of step objects from the AI engine.
 */
function renderReasoningSteps(steps) {
  const container = document.getElementById('steps-timeline');
  if (!steps || steps.length === 0) {
    container.innerHTML = '<p class="text-muted">No reasoning steps were reconstructed.</p>';
    return;
  }

  const html = steps.map(step => `
    <div class="step-card" id="step-${step.step_number}">
      <div class="step-header">
        <span class="step-number">${step.step_number}</span>
        <span class="badge ${step.step_type === 'observable' ? 'badge-success' : 'badge-info'}">
          ${step.step_type}
        </span>
        <span class="step-confidence">${step.confidence}% confidence</span>
      </div>
      <p class="step-description">${step.description}</p>
      <p class="step-evidence"><strong>Evidence:</strong> ${step.evidence}</p>
      <div class="confidence-bar-container">
        <div class="confidence-bar" style="width: ${step.confidence}%"></div>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;

  // Animate steps in with staggered delay
  const cards = container.querySelectorAll('.step-card');
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px)';
    setTimeout(() => {
      card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, i * 80);
  });
}
```

---

### Step 5: Polling for Analysis Status

In js/analysis.js, the polling logic:

```javascript
/**
 * Poll the analysis status endpoint until completed or failed.
 * @param {string} analysisId - The analysis UUID to poll.
 */
async function pollAnalysisStatus(analysisId) {
  const POLL_INTERVAL_MS = 3000;
  const MAX_ATTEMPTS = 20; // 20 * 3s = 60 seconds max wait
  let attempts = 0;

  showLoading('analysis-result-container');
  updateLoadingMessage('analysis-result-container', 'Reconstructing your reasoning trace... This may take up to 30 seconds.');

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      attempts++;
      try {
        const data = await CogniAPI.apiRequest(`/analysis/status/${analysisId}`);
        if (data.status === 'completed') {
          clearInterval(interval);
          resolve(data);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          reject(new Error(data.error_message || 'Analysis failed on the server.'));
        }
        // If still 'queued' or 'processing', continue polling
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }

      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        reject(new Error('Analysis timed out. Please try again.'));
      }
    }, POLL_INTERVAL_MS);
  });
}
```

---

### Step 6: History Router - routers/history.py

#### GET /api/history/list

Purpose: Return the full analysis history for the current user.

Authentication: Required.

Logic:
1. Verify JWT, get user_id.
2. Join history, user_uploads, and ai_analyses tables.
3. Query: SELECT h.history_id, u.file_name, u.file_type, a.analysis_id, a.confidence_score, a.performance_metric, h.viewed_at FROM history h JOIN user_uploads u ON h.upload_id = u.upload_id JOIN ai_analyses a ON h.analysis_id = a.analysis_id WHERE h.user_id = {user_id} ORDER BY h.viewed_at DESC.
4. Return array of history records.

Success response:
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

---

### Step 7: Full Integration Checklist

This checklist must be completed before the project is declared integration-ready. Check each item manually.

Authentication Flow:
- Register a new user via register.html. Confirm row appears in Supabase users table.
- Login with the same credentials. Confirm JWT is stored in localStorage.
- Access dashboard.html without a token. Confirm redirect to login.html.
- Access dashboard.html with a valid token. Confirm page loads with real or mock data.
- Click logout. Confirm token is cleared and user is redirected.

Upload Flow:
- Upload a valid CSV file via uploads.html. Confirm file appears in Supabase Storage bucket.
- Confirm row appears in user_uploads table with status 'pending', then 'completed'.
- Attempt to upload a .txt file. Confirm 400 error is displayed.
- Attempt to upload a file over 10 MB. Confirm client-side error is shown before upload starts.

Analysis Flow:
- Trigger an analysis from the uploads page. Confirm analysis_id is returned.
- Navigate to analysis.html with the analysis_id. Confirm polling begins.
- Confirm the spinner and loading message are displayed during polling.
- Confirm results render correctly when status becomes 'completed'.
- Confirm reasoning steps are displayed in the timeline with animations.
- Confirm consistency flags display correctly for analyses with flags.

History Flow:
- After completing an analysis, navigate to history.html.
- Confirm the analysis appears in the table.
- Confirm sorting works on all columns.
- Confirm search filter narrows results correctly.
- Confirm file name links navigate to the correct analysis.html page.

Error Handling:
- Disconnect the backend and trigger any API call from the frontend. Confirm error message is shown (not a blank screen or console error only).
- Pass a malformed JWT in localStorage. Confirm 401 is handled and user is redirected to login.
- Trigger an analysis on an empty CSV. Confirm the error is caught and displayed gracefully.

---

### Step 8: Deployment Checklist

Backend deployment (Render free tier):
1. Push backend/ directory to a GitHub repository.
2. Create a new Render Web Service. Connect the GitHub repo.
3. Set build command: pip install -r requirements.txt.
4. Set start command: uvicorn main:app --host 0.0.0.0 --port $PORT.
5. Add all environment variables from .env.example in the Render dashboard.
6. Update CORS allow_origins in main.py to your actual frontend URL.
7. Verify the root endpoint returns 200 at your Render URL.

Frontend deployment (GitHub Pages or Vercel):
1. Push frontend/ directory to a GitHub repository.
2. In js/api.js, update API_BASE_URL to your Render backend URL.
3. Set MOCK_MODE to false.
4. Deploy via GitHub Pages (Settings > Pages > Deploy from branch) or Vercel (import project).
5. Confirm all pages load and API calls reach the backend.

---

### Step 9: Known Free-Tier Limits and Mitigations

Supabase free tier:
- Database: 500 MB storage. Mitigation: store only metadata in DB, files in Storage.
- Storage: 1 GB. Mitigation: enforce 10 MB file size limit, allow users to delete old uploads.
- Bandwidth: 5 GB/month. Mitigation: serve files via signed URLs, not public direct links.
- The project pauses after 1 week of inactivity. Mitigation: set up a free cron job at cron-job.org to ping the Supabase URL weekly.

Gemini API free tier:
- Rate limit: 15 requests per minute, 1500 requests per day on gemini-1.5-flash.
- Mitigation: cache analysis results (never re-analyze the same file twice), add retry logic with exponential backoff.

Groq API free tier:
- Rate limit: varies by model, approximately 14400 tokens per minute on llama3-70b.
- Mitigation: truncate log data to first 50 rows before sending to LLM if file is large.

Render free tier:
- Service sleeps after 15 minutes of inactivity.
- Cold start takes 30-60 seconds.
- Mitigation: show a "Server is waking up, please wait..." message on the frontend if the first API call takes more than 5 seconds.

---

### Step 10: Local Development Setup for New Agents

A new agent joining the project must follow these exact steps:

1. Clone the repository.
2. Copy backend/.env.example to backend/.env and fill in all values.
3. Create a Python virtual environment: python -m venv venv.
4. Activate it: venv\Scripts\activate (Windows) or source venv/bin/activate (Unix).
5. Install dependencies: pip install -r backend/requirements.txt.
6. Run the backend: cd backend && uvicorn main:app --reload --port 8000.
7. Open frontend/dashboard.html in a browser (use VS Code Live Server extension or python -m http.server 3000 from the frontend/ directory).
8. In api.js, confirm API_BASE_URL is http://localhost:8000/api and MOCK_MODE is false for integration testing.
9. To test the frontend in isolation (without the backend): set MOCK_MODE to true in api.js.
10. Run all integration checklist items from Step 7 before committing any changes.
