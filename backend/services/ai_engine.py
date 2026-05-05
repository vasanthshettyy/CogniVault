"""
CogniVault - AI Engine Service
Two-stage LangChain LCEL pipeline for cognitive trace reconstruction.

Stage 1: Behavioral Extraction — identify actions, patterns, anomalies.
Stage 2: Reasoning Inference — reconstruct hidden thought processes.

Uses Pydantic output parsing for structured, validated results.
Supports Google Gemini (primary) and Groq (fallback) LLM providers.
"""

import os
import json
import time
import logging
import httpx
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Pydantic Schemas
class ReasoningStep(BaseModel):
    step_number: int = Field(description="Sequential step number")
    description: str = Field(description="What the user was likely thinking or doing")
    evidence: str = Field(description="Which log entries support this inference")
    confidence: float = Field(description="Confidence score for this step, 0-100")
    step_type: str = Field(description="Either 'observable' (directly from logs) or 'inferred' (AI-reconstructed)")

class ConsistencyFlag(BaseModel):
    description: str = Field(description="Description of the inconsistency")
    severity: str = Field(description="Severity level: 'low', 'medium', or 'high'")
    related_steps: List[int] = Field(description="Step numbers involved in this inconsistency")

class ImputedFieldMetadata(BaseModel):
    logic: str = Field(description="Why this specific field was predicted")
    confidence: float = Field(ge=0, le=100, description="Confidence in this specific field prediction")

class ImputedAction(BaseModel):
    model_config = {"extra": "allow"}
    
    is_imputed: bool = Field(description="True if any part of this row was predicted by AI.")
    imputed_fields: List[str] = Field(default_factory=list, description="List of field names that were filled by AI")
    field_logic: Dict[str, ImputedFieldMetadata] = Field(default_factory=dict, description="Unique reasoning for each imputed field")

class PredictiveForesight(BaseModel):
    pattern_name: str = Field(description="Name of the behavioral pattern")
    future_prediction: str = Field(description="How this behavior is likely to evolve")
    impact: str = Field(description="Potential impact on the project")

class CognitiveTraceAnalysis(BaseModel):
    summary: str = Field(description="2-3 sentence executive summary of the cognitive trace")
    reconstructed_steps: List[str] = Field(description="Ordered list of high-level reasoning steps in plain English")
    reasoning_steps: List[ReasoningStep] = Field(description="Detailed reasoning steps with evidence and confidence")
    detected_patterns: List[str] = Field(description="Behavioral patterns identified in the activity logs")
    predictive_foresight: List[PredictiveForesight] = Field(default_factory=list, description="Forward-looking behavioral analysis")
    consistency_flags: List[ConsistencyFlag] = Field(description="Any inconsistencies or anomalies detected")
    reconstructed_data_log: List[ImputedAction] = Field(description="List of data points that were completed/filled by AI")
    missing_density: float = Field(default=0.0, description="Percentage of missing data in the original log")
    confidence_score: float = Field(description="Overall confidence in the reconstruction, 0-100")
    performance_metric: float = Field(description="Quality/coherence score of the reasoning trace, 0-100")

import re

def extract_json(text: str) -> str:
    """Extract JSON from markdown code blocks if present."""
    # Find the last json block (usually the final output)
    match = re.search(r'```(?:json)?(.*?)```', text, re.DOTALL | re.IGNORECASE)
    if match:
        # If multiple blocks exist, find all and take the last one
        matches = re.findall(r'```(?:json)?(.*?)```', text, re.DOTALL | re.IGNORECASE)
        if matches:
            return matches[-1].strip()
    
    # Fallback to stripping if no code blocks are found
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def call_gemini(prompt: str) -> str:
    """Call Google Gemini REST API via httpx."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("No Gemini API key found. Set GEMINI_API_KEY in .env")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3}
    }
    
    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]

def call_groq(prompt: str) -> str:
    """Call Groq API (OpenAI-compatible) via httpx."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("No Groq API key found. Set GROQ_API_KEY in .env")
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3
    }
    
    with httpx.Client(timeout=60.0) as client:
        response = client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

def call_llm(prompt: str) -> str:
    """Try Gemini first, fallback to Groq on any error."""
    try:
        return call_gemini(prompt)
    except Exception as e:
        logger.warning(f"Gemini call failed: {str(e)}. Falling back to Groq...")
        try:
            return call_groq(prompt)
        except Exception as groq_e:
            raise Exception(f"Both Gemini and Groq failed. Gemini: {str(e)}, Groq: {str(groq_e)}")

def reconstruct_reasoning(clean_data: Dict[str, Any]) -> Dict[str, Any]:
    """Execute the pipeline using LLM providers with fallback logic."""
    entries = clean_data.get("entries", [])
    max_entries = 50
    if len(entries) > max_entries:
        entries = entries[:max_entries // 2] + entries[-(max_entries // 2):]

    log_data_str = json.dumps(entries, indent=2, default=str)
    summary = clean_data.get("summary", {})
    entry_count = summary.get("entry_count", len(entries))
    fields = ", ".join(summary.get("fields", []))

    logger.info("Stage 1: Behavioral Extraction starting...")
    stage1_prompt = f"""
You are CogniVault's Behavioral Analysis Engine.
Analyze the following activity log data and extract behavioral patterns.

**Log Data:**
{log_data_str}

**Data Summary:**
- Total entries: {entry_count}
- Fields available: {fields}

Return a JSON object with these keys:
- "actions": list of identified actions
- "patterns": list of behavioral patterns detected.
- "predictive_foresight": A list of objects explaining potential future behaviors based on these patterns. Each object should have:
    "pattern_name": Name of the pattern.
    "future_prediction": How this behavior is likely to evolve or what the user will do next.
    "impact": The potential impact on the dataset/project.
- "anomalies": list of unusual behaviors
- "action_sequence": ordered list of high-level actions
"""
    stage1_output = call_llm(stage1_prompt)
    try:
        stage1_output_json = json.loads(extract_json(stage1_output))
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Stage 1 output: {stage1_output}")
        raise ValueError(f"Invalid JSON from LLM: {str(e)}")
    logger.info("Stage 1 complete.")

    logger.info("Stage 2: Reasoning Inference starting...")
    schema = CognitiveTraceAnalysis.model_json_schema()
    
    stage2_prompt = f"""
You are CogniVault's Cognitive Reasoning Reconstructor.
You are healing a fragmented activity log. Your mission is to provide an **accurate, de-fragmented version** of the input logs with field-level precision.

**GROUNDING DATA (FRAGMENTED LOGS):**
{log_data_str}

**BEHAVIORAL ANALYSIS IDENTIFIED:**
- Patterns: {stage1_output_json.get('patterns', [])}
- Predictive Foresight: {stage1_output_json.get('predictive_foresight', [])}

**STRICT RULES FOR `reconstructed_data_log`:**
1. You MUST return exactly {entry_count} entries.
2. You MUST use the EXACT field names provided in the original logs: {fields}.
3. **Aggressive Imputation Directive**: For each entry, examine every field:
   - If the input `is_missing: false`, preserve its original value exactly.
   - If the input `is_missing: true`, it IS an imputed field. NO EXCEPTIONS. You MUST predict its value based on context.
   - For EVERY missing field you predict:
     a) Set `is_imputed: true` for the row.
     b) List the field name in `imputed_fields`.
     c) Add an entry in `field_logic`. **CRITICAL**: You are a forensic data expert. For every imputed field, you MUST provide a unique explanation. Example: 'Inferred based on the Recovery Loop pattern as the user successfully reset their password at 10:05'. Do NOT repeat the same logic across different fields. Explicitly FORBIDDEN phrases: 'Inferred based on context', 'Predicted via patterns'. Reference the specific patterns detected in Stage 1.
4. Chronological Integrity: You MUST preserve the original order. The `timestamp` field MUST match the original log's sequence.

**Example Row Structure:**
{{
  "timestamp": "2024-01-01 10:00",
  "event_type": "file_open",
  ...,
  "is_imputed": true,
  "imputed_fields": ["project", "action_detail"],
  "field_logic": {{
    "project": {{ "logic": "Imputed based on the 'Module Focus' pattern, as previous edits were in ecommerce-app.", "confidence": 95 }},
    "action_detail": {{ "logic": "Imputed based on the 'Exploratory Search' pattern, user was investigating the 'Cannot read property' error.", "confidence": 85 }}
  }}
}}

**Final Output Requirement:**
Include the `predictive_foresight` from the behavioral analysis in your response.

You MUST return ONLY a valid JSON object matching this exact schema:
{json.dumps(schema, indent=2)}
"""
    result_text = call_llm(stage2_prompt)
    logger.info("Stage 2 complete.")
    
    parsed_json = json.loads(extract_json(result_text))
    # Inject missing density from preprocessor into the validated result
    if "missing_density" not in parsed_json:
        parsed_json["missing_density"] = summary.get("missing_density", 0.0)
        
    validated = CognitiveTraceAnalysis(**parsed_json)
    return validated.model_dump()

def reconstruct_reasoning_with_retry(clean_data: Dict[str, Any], max_retries: int = 2, base_delay: float = 2.0) -> Dict[str, Any]:
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Analysis attempt {attempt}/{max_retries}")
            return reconstruct_reasoning(clean_data)
        except Exception as e:
            last_error = e
            logger.warning(f"Attempt {attempt} failed: {str(e)}")
            if attempt < max_retries:
                time.sleep(base_delay * (2 ** (attempt - 1)))
    raise Exception(f"Analysis failed after {max_retries} attempts: {str(last_error)}")
