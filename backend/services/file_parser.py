"""
CogniVault - File Parser Service
Reads uploaded files (CSV, XLSX, PDF) and converts them to a unified
list-of-dict format for the preprocessor.
"""

import io
import csv
import openpyxl
import PyPDF2
from typing import List, Dict, Any


def parse_csv(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parse CSV bytes into a list of row dictionaries.

    Parameters:
        file_bytes (bytes): Raw CSV file content.

    Returns:
        List[Dict]: Each row as a dictionary with normalized column names.
    """
    text = file_bytes.decode('utf-8', errors='replace')
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames:
        reader.fieldnames = [col.strip().lower().replace(" ", "_") for col in reader.fieldnames]
    return list(reader)


def parse_xlsx(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parse Excel XLSX bytes into a list of row dictionaries using openpyxl directly.

    Parameters:
        file_bytes (bytes): Raw XLSX file content.

    Returns:
        List[Dict]: Each row as a dictionary with normalized column names.
    """
    wb = openpyxl.load_workbook(filename=io.BytesIO(file_bytes), data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    
    headers = [str(col).strip().lower().replace(" ", "_") if col else f"col_{i}" for i, col in enumerate(rows[0])]
    data = []
    for row in rows[1:]:
        data.append(dict(zip(headers, row)))
    return data


def parse_pdf(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extract text from PDF and return as a list with one entry per page.

    Parameters:
        file_bytes (bytes): Raw PDF file content.

    Returns:
        List[Dict]: Each page as {"page": int, "content": str}.
    """
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"page": i + 1, "content": text.strip()})
        return pages
    except PyPDF2.errors.PdfReadError:
        raise ValueError("The uploaded file is not a valid PDF document. It may be corrupted or incorrectly named.")


def _detect_actual_format(file_bytes: bytes, claimed_type: str) -> str:
    """
    Inspect the raw bytes to detect the real file format.
    Returns the corrected type string ('csv', 'xlsx', 'pdf').
    """
    # PDF files always start with %PDF
    if file_bytes[:5] == b"%PDF-":
        return "pdf"
    # XLSX (ZIP-based) files start with PK signature
    if file_bytes[:4] == b"PK\x03\x04":
        return "xlsx"
    # If the file looks like readable text, treat it as CSV
    try:
        sample = file_bytes[:2048].decode("utf-8", errors="strict")
        if "," in sample or "\t" in sample:
            return "csv"
    except UnicodeDecodeError:
        pass
    # Fall back to whatever the caller said
    return claimed_type


def parse_file(file_bytes: bytes, file_type: str) -> List[Dict[str, Any]]:
    """
    Route to the correct parser based on file_type.
    Auto-detects the real format when the extension is misleading
    (e.g. a CSV file saved with a .pdf extension).

    Parameters:
        file_bytes (bytes): Raw file content.
        file_type (str): One of 'csv', 'xlsx', 'pdf'.

    Returns:
        List[Dict]: Parsed data rows.

    Raises:
        ValueError: If file_type is not supported.
    """
    actual_type = _detect_actual_format(file_bytes, file_type)
    if actual_type != file_type:
        import logging
        logging.getLogger(__name__).warning(
            "File claimed to be '%s' but detected as '%s' — using detected format.",
            file_type, actual_type,
        )

    if actual_type == "csv":
        return parse_csv(file_bytes)
    elif actual_type == "xlsx":
        return parse_xlsx(file_bytes)
    elif actual_type == "pdf":
        return parse_pdf(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {actual_type}")
