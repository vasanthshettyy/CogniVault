"""
CogniVault - Preprocessor Service
Cleans and normalizes parsed data before sending to the AI engine.
"""

from typing import List, Dict, Any


def clean_log_data(raw_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Clean and normalize raw parsed rows with "Empty Bits" detection.
    Wraps each field in an object tracking its state and calculates
    missing data density.

    Parameters:
        raw_rows (List[Dict]): Raw parsed data from the file parser.

    Returns:
        Dict with keys:
        - total_entries (int): Number of cleaned entries.
        - entries (List[Dict]): Data rows with masked values.
        - summary (Dict): Metadata including fields, entry_count, and missing_density.
    """
    cleaned_entries = []
    total_cells = 0
    missing_cells = 0

    # Get all unique fields across all rows to ensure consistent structure
    all_fields = set()
    for row in raw_rows:
        all_fields.update(row.keys())
    all_fields = sorted(list(all_fields))

    for row in raw_rows:
        entry = {}
        for field in all_fields:
            val = row.get(field)
            is_missing = False

            # Detection logic for "Empty Bits"
            missing_patterns = ["", "unknown", "n/a", "na", "null", "undefined", "none", "-"]
            
            if val is None:
                is_missing = True
            elif isinstance(val, float) and str(val).lower() == 'nan':
                is_missing = True
            elif isinstance(val, str):
                val_clean = val.strip().lower()
                if val_clean in missing_patterns:
                    is_missing = True
            
            total_cells += 1
            if is_missing:
                missing_cells += 1
            
            entry[field] = {
                "value": val,
                "is_missing": is_missing
            }

        cleaned_entries.append(entry)

    # Calculate missing density (percentage of missing values)
    missing_density = 0
    if total_cells > 0:
        missing_density = (missing_cells / total_cells) * 100

    return {
        "total_entries": len(cleaned_entries),
        "entries": cleaned_entries,
        "summary": {
            "fields": all_fields,
            "entry_count": len(cleaned_entries),
            "missing_density": round(missing_density, 2)
        }
    }
