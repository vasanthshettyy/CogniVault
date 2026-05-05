import os
import json
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

def check_status():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
        return

    supabase = create_client(url, key)
    
    print("--- Recent Uploads ---")
    uploads = supabase.table("user_uploads").select("*").order("uploaded_at", desc=True).limit(5).execute()
    for u in uploads.data:
        print(f"ID: {u['upload_id']} | File: {u['file_name']} | Status: {u['upload_status']} | Time: {u['uploaded_at']}")
    
    print("\n--- Recent Analyses ---")
    analyses = supabase.table("ai_analyses").select("*").order("created_at", desc=True).limit(5).execute()
    for a in analyses.data:
        error = a.get('error_message')
        print(f"ID: {a['analysis_id']} | Status: {a['status']} | Error: {error} | Time: {a['created_at']}")

if __name__ == "__main__":
    check_status()
