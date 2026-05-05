import sys
import json
import os
from services.file_parser import parse_file
from services.preprocessor import clean_log_data
from services.ai_engine import reconstruct_reasoning_with_retry

def main():
    if len(sys.argv) < 2:
        print("Usage: python alternative_analysis.py <path_to_file>")
        print("Example: python alternative_analysis.py ../test_data/sample.csv")
        sys.exit(1)
        
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found.")
        sys.exit(1)
        
    file_ext = file_path.rsplit('.', 1)[-1].lower()
    if file_ext not in ['csv', 'xlsx', 'pdf']:
        print(f"Error: Unsupported file type '{file_ext}'. Must be csv, xlsx, or pdf.")
        sys.exit(1)
        
    print(f"Reading file {file_path}...")
    try:
        with open(file_path, "rb") as f:
            file_bytes = f.read()
    except Exception as e:
        print(f"Failed to read file: {e}")
        sys.exit(1)
        
    print(f"Parsing file as {file_ext.upper()}...")
    try:
        parsed_data = parse_file(file_bytes, file_ext)
        print(f"Extracted {len(parsed_data)} rows/pages.")
    except Exception as e:
        print(f"Failed to parse file: {e}")
        sys.exit(1)
    
    print(f"Preprocessing data...")
    try:
        clean_data = clean_log_data(parsed_data)
        print(f"Cleaned data contains {clean_data['total_entries']} entries.")
    except Exception as e:
        print(f"Failed to preprocess data: {e}")
        sys.exit(1)
    
    print(f"Running AI analysis via Gemini (this may take a minute)...")
    try:
        result = reconstruct_reasoning_with_retry(clean_data)
        
        output_file = "analysis_result.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
            
        print(f"\nSuccess! Analysis results saved to {output_file}")
        print("\n--- Summary ---")
        print(result.get("summary", "No summary available"))
        print("\n--- Detected Patterns ---")
        for pattern in result.get("detected_patterns", []):
            print(f"- {pattern}")
            
    except Exception as e:
        print(f"\nAnalysis failed: {str(e)}")
        print("\nPlease ensure your GEMINI_API_KEY or GOOGLE_API_KEY is correctly set in backend/.env")

if __name__ == "__main__":
    main()
