"""Layout analysis and page extraction for ExamQuest ingestion."""

import re
from typing import Any, Dict, List, Optional, Tuple
import yaml


def load_profile(profile_path: str) -> Dict[str, Any]:
    """Load an exam profile YAML file."""
    with open(profile_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def is_ad_page(page, min_text_len: int = 150, min_image_coverage: float = 0.5) -> bool:
    """Detect if a page is a full-page advertisement.
    
    Heuristic: text length is very low (<150 chars) and page contains an image
    covering more than 50% of the page area.
    """
    text = (page.extract_text() or "").strip()
    if len(text) >= min_text_len:
        return False
    
    page_area = float(page.width) * float(page.height)
    if page_area <= 0:
        return False

    for im in page.images:
        im_area = float(im.get("width", 0)) * float(im.get("height", 0))
        if (im_area / page_area) >= min_image_coverage:
            return True
    
    # Also if text is virtually 0 and there are images
    if len(text) < 30 and len(page.images) > 0:
        return True

    return False


def is_noise_text(text: str, noise_patterns: List[str]) -> bool:
    """Check if a line matches any known noise pattern."""
    t = text.strip()
    if not t:
        return True
    for pattern in noise_patterns:
        if re.search(pattern, t):
            return True
    return False


def group_words_into_lines(words: List[Dict[str, Any]], y_tolerance: float = 3.5) -> List[Dict[str, Any]]:
    """Group extracted words into coherent lines sorted vertically and horizontally.
    
    Each line dictionary contains:
    - text: str
    - top: float
    - bottom: float
    - x0: float
    - x1: float
    - is_bold: bool
    - words: List[Dict]
    """
    if not words:
        return []

    sorted_words = sorted(words, key=lambda w: (w["top"], w["x0"]))
    lines_words: List[List[Dict[str, Any]]] = []
    curr_line: List[Dict[str, Any]] = []
    curr_top: Optional[float] = None

    for w in sorted_words:
        if curr_top is None or abs(w["top"] - curr_top) <= y_tolerance:
            curr_line.append(w)
            curr_top = (curr_top * (len(curr_line) - 1) + w["top"]) / len(curr_line) if curr_top else w["top"]
        else:
            lines_words.append(curr_line)
            curr_line = [w]
            curr_top = w["top"]
    if curr_line:
        lines_words.append(curr_line)

    result: List[Dict[str, Any]] = []
    for line_w in lines_words:
        sorted_line = sorted(line_w, key=lambda w: w["x0"])
        text = " ".join(w["text"] for w in sorted_line).strip()
        if not text:
            continue
        top = min(w["top"] for w in sorted_line)
        bottom = max(w["bottom"] for w in sorted_line)
        x0 = min(w["x0"] for w in sorted_line)
        x1 = max(w["x1"] for w in sorted_line)
        is_bold = any(
            "bold" in str(w.get("fontname", "")).lower()
            for w in sorted_line
        )
        result.append({
            "text": text,
            "top": top,
            "bottom": bottom,
            "x0": x0,
            "x1": x1,
            "is_bold": is_bold,
            "words": sorted_line,
        })

    return result


def extract_metadata(first_page_lines: List[Dict[str, Any]], profile: Dict[str, Any]) -> Dict[str, Any]:
    """Extract exam metadata from the title line or header of the first page."""
    exam_name = profile.get("name", "Exam Paper")
    date_str = None
    shift = None
    title = None

    title_regex = profile.get("title_regex", r"(?i)SSC\s+CGL.*?Paper")

    for l in first_page_lines:
        t = l["text"]
        m = re.search(title_regex, t)
        if m:
            title = t
            # Try finding date like 01 Oct 2026 or 12 Sep 2025
            date_match = re.search(r"(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})", t)
            if date_match:
                date_str = date_match.group(1)
            # Try finding shift like S1 or Shift 1
            shift_match = re.search(r"(?:Shift|S)\s*(\d)", t, re.IGNORECASE)
            if shift_match:
                shift = int(shift_match.group(1))
            break

    # Standardize date to YYYY-MM-DD
    iso_date = None
    if date_str:
        months = {
            "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
            "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"
        }
        parts = date_str.split()
        if len(parts) == 3:
            day = parts[0].zfill(2)
            month = months.get(parts[1][:3].lower(), "01")
            year = parts[2]
            iso_date = f"{year}-{month}-{day}"

    return {
        "title": title or exam_name,
        "exam": exam_name,
        "date": iso_date or "2026-10-01",
        "shift": shift,
    }
