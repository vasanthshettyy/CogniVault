"""
CogniVault - AI Engine Integration Test
Runs the two-stage pipeline with sample data to verify it works end-to-end.

Usage:
    cd backend
    python tests/test_ai_engine.py
"""

import sys
import os
import json

# Add backend root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
load_dotenv()

from services.ai_engine import reconstruct_reasoning_with_retry, get_llm


# Sample activity log data simulating a user's work session
SAMPLE_DATA = {
    "total_entries": 8,
    "entries": [
        {
            "timestamp": "2024-01-15T09:00:12",
            "action": "login",
            "resource": "dashboard",
            "duration_seconds": 3
        },
        {
            "timestamp": "2024-01-15T09:02:45",
            "action": "navigate",
            "resource": "project_settings",
            "duration_seconds": 15
        },
        {
            "timestamp": "2024-01-15T09:05:30",
            "action": "modify",
            "resource": "config.yaml",
            "duration_seconds": 120,
            "details": "Changed deployment target from staging to production"
        },
        {
            "timestamp": "2024-01-15T09:08:00",
            "action": "navigate",
            "resource": "deployment_logs",
            "duration_seconds": 45
        },
        {
            "timestamp": "2024-01-15T09:10:30",
            "action": "navigate",
            "resource": "project_settings",
            "duration_seconds": 10,
            "details": "Returned to settings after checking logs"
        },
        {
            "timestamp": "2024-01-15T09:12:00",
            "action": "modify",
            "resource": "config.yaml",
            "duration_seconds": 60,
            "details": "Reverted deployment target back to staging"
        },
        {
            "timestamp": "2024-01-15T09:14:00",
            "action": "create",
            "resource": "hotfix_branch",
            "duration_seconds": 30,
            "details": "Created branch hotfix/config-rollback"
        },
        {
            "timestamp": "2024-01-15T09:16:00",
            "action": "logout",
            "resource": "dashboard",
            "duration_seconds": 2
        }
    ],
    "summary": {
        "fields": ["timestamp", "action", "resource", "duration_seconds", "details"],
        "entry_count": 8
    }
}


def test_llm_connection():
    """Test that an LLM provider is available."""
    print("=" * 60)
    print("TEST 1: LLM Connection")
    print("=" * 60)
    try:
        llm = get_llm()
        result = llm.invoke("Say 'CogniVault AI Engine is operational' in exactly those words.")
        content = result.content if hasattr(result, 'content') else str(result)
        print(f"✅ LLM Response: {content[:100]}...")
        return True
    except Exception as e:
        print(f"❌ LLM Connection Failed: {e}")
        return False


def test_full_pipeline():
    """Test the complete two-stage pipeline with sample data."""
    print("\n" + "=" * 60)
    print("TEST 2: Full Pipeline (Two-Stage LCEL)")
    print("=" * 60)
    try:
        print("Sending sample data through pipeline...")
        print(f"  Entries: {SAMPLE_DATA['total_entries']}")
        print(f"  Fields: {SAMPLE_DATA['summary']['fields']}")
        print()

        result = reconstruct_reasoning_with_retry(SAMPLE_DATA, max_retries=2)

        print("✅ Pipeline completed successfully!\n")
        print(f"📊 Confidence Score: {result['confidence_score']}/100")
        print(f"📊 Performance Metric: {result['performance_metric']}/100")
        print(f"\n📝 Summary:\n   {result['summary']}")

        print(f"\n🧠 Reconstructed Steps ({len(result['reconstructed_steps'])}):")
        for i, step in enumerate(result['reconstructed_steps'], 1):
            print(f"   {i}. {step}")

        print(f"\n🔍 Detailed Reasoning Steps ({len(result['reasoning_steps'])}):")
        for step in result['reasoning_steps']:
            print(f"   Step {step['step_number']}: [{step['step_type']}] {step['description']}")
            print(f"     Evidence: {step['evidence'][:80]}...")
            print(f"     Confidence: {step['confidence']}%")

        print(f"\n🔮 Detected Patterns ({len(result['detected_patterns'])}):")
        for pattern in result['detected_patterns']:
            print(f"   • {pattern}")

        print(f"\n🚩 Consistency Flags ({len(result['consistency_flags'])}):")
        if result['consistency_flags']:
            for flag in result['consistency_flags']:
                print(f"   [{flag['severity'].upper()}] {flag['description']}")
                print(f"     Related steps: {flag['related_steps']}")
        else:
            print("   None — reasoning trace is internally consistent.")

        # Save full result to file for inspection
        output_path = os.path.join(os.path.dirname(__file__), "test_output.json")
        with open(output_path, "w") as f:
            json.dump(result, f, indent=2)
        print(f"\n💾 Full result saved to: {output_path}")

        return True

    except Exception as e:
        print(f"❌ Pipeline Failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🧪 CogniVault AI Engine Integration Tests")
    print("=" * 60)

    # Check for API keys
    has_gemini = bool(os.getenv("GOOGLE_API_KEY"))
    has_groq = bool(os.getenv("GROQ_API_KEY"))
    print(f"Gemini API Key: {'✅ Set' if has_gemini else '❌ Not set'}")
    print(f"Groq API Key:   {'✅ Set' if has_groq else '❌ Not set'}")

    if not has_gemini and not has_groq:
        print("\n⚠️  No LLM API key found!")
        print("Set GOOGLE_API_KEY or GROQ_API_KEY in backend/.env")
        print("You can get a free key from:")
        print("  - https://aistudio.google.com/apikey")
        print("  - https://console.groq.com/keys")
        sys.exit(1)

    print()

    # Run tests
    test1 = test_llm_connection()
    test2 = test_full_pipeline() if test1 else False

    print("\n" + "=" * 60)
    print("RESULTS:")
    print(f"  LLM Connection: {'PASS ✅' if test1 else 'FAIL ❌'}")
    print(f"  Full Pipeline:  {'PASS ✅' if test2 else 'FAIL ❌'}")
    print("=" * 60)
