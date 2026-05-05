"""
CogniVault - Supabase Database Client
Returns an authenticated Supabase client using the service role key.
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv
load_dotenv(override=True)


import httpx
from db.local_client import get_local_client

def get_supabase() -> Client:
    """
    Return an authenticated Supabase client.
    FALLBACK: If Supabase is unreachable or keys are missing, returns a local 
    JSON-based client to keep the app functional during hackathons/testing.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key or "[YOUR-" in url or "[YOUR-" in key:
        print("[DB] Supabase keys missing or invalid. Falling back to local mode.")
        return get_local_client()

    # Quick reachability check (2 second timeout)
    try:
        # We only check the URL reachability. If it times out, we assume network issues.
        with httpx.Client(timeout=2.0) as client:
            resp = client.get(url)
            # If we get any response (even 404/401), the service is up
    except Exception:
        print(f"[DB] Supabase unreachable at {url}. Falling back to local mode.")
        return get_local_client()

    try:
        return create_client(url, key)
    except Exception as e:
        print(f"[DB] Supabase client creation failed: {e}. Falling back to local mode.")
        return get_local_client()
