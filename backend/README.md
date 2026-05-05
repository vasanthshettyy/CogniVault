# CogniVault Backend

FastAPI backend with AI reasoning reconstruction engine.

## Setup

```bash
cp .env.example .env        # Fill in your keys
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## API Docs

Once running, visit: http://localhost:8000/docs
