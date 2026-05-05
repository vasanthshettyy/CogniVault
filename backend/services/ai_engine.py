"""
CogniVault - AI Engine Service
Two-stage LangChain LCEL pipeline for cognitive trace reconstruction.
"""

import os
import json
import time
import logging
import httpx
import google.generativeai as genai
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Pydantic Schemas (Internal for Engine)
class ReasoningStep(BaseModel):
    step_number: int
    description: str
    evidence: str
    confidence: float
    step_type: str

class ConsistencyFlag(BaseModel):
    description: str
    severity: str
    related_steps: List[int]

class ImputedFieldMetadata(BaseModel):
    logic: str
    confidence: float

class ImputedAction(BaseModel):
    model_config = {"extra": "allow"}
    is_imputed: bool = False
    imputed_fields: List[str] = []
    field_logic: Dict[str, ImputedFieldMetadata] = {}

class PredictiveForesight(BaseModel):
    pattern_name: str
    future_prediction: str
    impact: str

class CognitiveTraceAnalysis(BaseModel):
    summary: str
    reconstructed_steps: List[str]
    reasoning_steps: List[ReasoningStep]
    detected_patterns: List[str]
    predictive_foresight: List[PredictiveForesight] = []
    consistency_flags: List[ConsistencyFlag]
    reconstructed_data_log: List[ImputedAction]
    missing_density: float = 0.0
    confidence_score: float
    performance_metric: float

import re

def extract_json(text: str) -> str:
    """Extract JSON from markdown code blocks or raw text."""
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        return text[start:end+1].strip()
    return text.strip()

def call_gemini(prompt: str) -> str:
    """Call Google Gemini using the official library."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("No Gemini API key found. Set GEMINI_API_KEY in .env")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content(prompt)
    if not response.text:
        raise Exception("Gemini returned an empty response")
    return response.text

def call_groq(prompt: str) -> str:
    """Call Groq API (OpenAI-compatible)."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("No Groq API key found. Set GROQ_API_KEY in .env")
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3
    }
    with httpx.Client(timeout=60.0) as client:
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]

def call_llm(prompt: str) -> str:
    """Try Gemini first, fallback to Groq."""
    try:
        return call_gemini(prompt)
    except Exception as e:
        logger.warning(f"Gemini failed: {str(e)}. Falling back to Groq...")
        try:
            return call_groq(prompt)
        except Exception as groq_e:
            time.sleep(1)
            raise Exception(f"Both failed. Gemini: {str(e)}, Groq: {str(groq_e)}")

def reconstruct_reasoning(clean_data: Dict[str, Any]) -> Dict[str, Any]:
    """Execute the two-stage pipeline."""
    entries = clean_data.get("entries", [])
    log_data_str = json.dumps(entries, indent=2, default=str)
    summary_meta = clean_data.get("summary", {})
    
    # STAGE 1: Pattern Extraction
    stage1_prompt = f"Analyze these logs for behavioral patterns: {log_data_str}. Return JSON with 'patterns' and 'predictive_foresight'."
    stage1_output = call_llm(stage1_prompt)
    try:
        stage1_json = json.loads(extract_json(stage1_output))
    except:
        stage1_json = {"patterns": [], "predictive_foresight": []}

    # STAGE 2: Forensic Reconstruction
    schema = CognitiveTraceAnalysis.model_json_schema()
    stage2_prompt = f"""
You are a Forensic Data Expert. Heal these fragmented logs: {log_data_str}
Patterns Detected: {stage1_json.get('patterns', [])}

STRICT RULES:
1. Return EXACTLY {len(entries)} rows in 'reconstructed_data_log'.
2. Use the 'is_imputed': true flag for ANY field you fill or modify.
3. For EVERY single field you impute, you MUST provide a unique 'field_logic' entry.
   - FORMAT: 'field_name': {{"logic": "SPECIFIC FORENSIC REASON", "confidence": 0-100}}
   - REQUIRED: Logic must tie to specific patterns (e.g., 'Inferred project as ecommerce-app based on the recurring src/components/Dashboard.tsx path seen in Stage 1').
4. Preserve original timestamps.

Return ONLY valid JSON matching this schema:
{json.dumps(schema, indent=2)}
"""
    result_text = call_llm(stage2_prompt)
    parsed_json = json.loads(extract_json(result_text))
    
    # Merge patterns
    if not parsed_json.get("detected_patterns"):
        parsed_json["detected_patterns"] = stage1_json.get("patterns", [])
    if not parsed_json.get("predictive_foresight"):
        parsed_json["predictive_foresight"] = stage1_json.get("predictive_foresight", [])

    return parsed_json

def reconstruct_reasoning_with_retry(clean_data: Dict[str, Any], max_retries: int = 2, base_delay: float = 2.0) -> Dict[str, Any]:
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            return reconstruct_reasoning(clean_data)
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                time.sleep(base_delay * (2 ** (attempt - 1)))
    raise Exception(f"Analysis failed: {str(last_error)}")
