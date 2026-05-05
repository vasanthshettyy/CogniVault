# CogniVault - Cognitive Trace Reconstruction System

> A web-based AI system that reconstructs user reasoning from activity logs using a hybrid approach (rule-based + LLM via LangChain).

---

## 🧠 What is CogniVault?

CogniVault analyzes user activity logs (CSV, PDF, XLSX) and uses a two-stage AI pipeline to:
1. **Extract behavioral patterns** from raw log data (observable actions, time gaps, corrections).
2. **Reconstruct hidden reasoning steps** — the thought processes behind the actions.

The system produces:
- **Confidence scores** for the overall reconstruction
- **Step-by-step reasoning timelines** with evidence citations
- **Behavioral pattern detection** (exploratory vs. linear thinking, deliberation gaps)
- **Consistency flags** highlighting contradictions in the reasoning trace

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│  Backend API │────▶│  AI Engine   │
│  (Vanilla JS)│◀────│  (FastAPI)   │◀────│ (LangChain)  │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │   Supabase   │
                     │  (DB + Storage)│
                     └──────────────┘
```

| Module | Technology |
|--------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) |
| Backend | Python FastAPI, Uvicorn |
| AI Engine | LangChain, Google Gemini / Groq LLM |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |

---

## 📂 Project Structure

```
CogniVault/
├── backend/          # FastAPI backend + AI engine
├── frontend/         # Static HTML/CSS/JS frontend
├── docs/             # API contracts and DB schema
├── roadmap.md        # Master development roadmap
└── README.md         # This file
```

---

## 🚀 Quick Start

### Backend
```bash
cd backend
cp .env.example .env        # Fill in your API keys
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
python -m http.server 3000   # Or use VS Code Live Server
# Open http://localhost:3000
```

### Frontend (Mock Mode)
Set `MOCK_MODE = true` in `js/api.js` to run without the backend.

---

## 🔑 Environment Variables

See `backend/.env.example` for all required variables.

| Variable | Source |
|----------|--------|
| SUPABASE_URL | Supabase Dashboard → Settings → API |
| SUPABASE_ANON_KEY | Supabase Dashboard → Settings → API |
| SUPABASE_SERVICE_KEY | Supabase Dashboard → Settings → API |
| GEMINI_API_KEY | https://aistudio.google.com/app/apikey |
| GROQ_API_KEY | https://console.groq.com |
| JWT_SECRET_KEY | Any long random string |

---

## 📝 License

This project is built for academic purposes. All dependencies are open-source with no usage fees.
