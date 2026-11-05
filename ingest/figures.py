"""Figure, table, and render_mode analysis for ExamQuest questions."""

import re
from typing import Any, Dict, List, Optional, Tuple


# Math and formula detection
MATH_SYMBOLS_REGEX = re.compile(r"[√²³⁴∈θ×÷±≠≤≥π∫∂∑∆△]")
TRIG_FUNCS_REGEX = re.compile(r"\b(sin|cos|tan|cot|sec|cosec)\b", re.IGNORECASE)
TABLE_KEYWORDS_REGEX = re.compile(
    r"\b(Matrix-?[I|V|X]+|Table\s*[-–]|S\.No\s+Factory|Column\s+[I|V|X]+|No\s+of\s+Students|Age\s+of\s+the\s+Students|Frequency|Class\s+Interval|Production\s+of\s+Cars|Exports\s+Imports)\b",
    re.IGNORECASE,
)


def detect_table_in_stem(
    stem_lines: Optional[List[Dict[str, Any]]],
    stem_text: str = "",
    page_tables: Optional[List[Any]] = None,
    stem_top: Optional[float] = None,
    stem_bottom: Optional[float] = None,
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """Detect if stem contains a tabular data structure by geometry or keywords.
    
    Returns:
        (is_table, reconstructed_table_or_None)
    """
    # 1. pdfplumber tables overlapping stem bounding box
    if page_tables and stem_top is not None and stem_bottom is not None:
        for t in page_tables:
            tb = t.bbox  # (x0, top, x1, bottom)
            # Vertical overlap with question stem region
            if not (tb[3] < stem_top - 5.0 or tb[1] > stem_bottom + 5.0):
                data = t.extract()
                if data and len(data) >= 2:
                    clean_rows = []
                    for row in data:
                        clean_row = [str(c or "").strip() for c in row if c is not None]
                        if any(clean_row):
                            clean_rows.append(clean_row)
                    if len(clean_rows) >= 2:
                        return True, {
                            "headers": clean_rows[0],
                            "rows": clean_rows[1:],
                        }

    # 2. Table keywords in text
    if TABLE_KEYWORDS_REGEX.search(stem_text):
        return True, None

    # 3. Geometric heuristic: 3 or more consecutive short lines (<= 4 tokens) and mostly numeric
    if stem_lines and len(stem_lines) >= 3:
        consecutive_numeric = 0
        for l in stem_lines:
            tokens = l["text"].strip().split()
            if 1 <= len(tokens) <= 5:
                # Count numeric tokens
                num_count = sum(
                    1
                    for tok in tokens
                    if re.match(r"^[-+]?\d*\.?\d+$", tok) or tok in ("%", "₹", "$")
                )
                if num_count >= 1 and (num_count / len(tokens)) >= 0.4:
                    consecutive_numeric += 1
                    if consecutive_numeric >= 3:
                        return True, None
                else:
                    consecutive_numeric = 0
            else:
                consecutive_numeric = 0

    # 4. Word horizontal alignments forming >= 2 distinct column clusters across >= 3 lines
    if stem_lines and len(stem_lines) >= 3:
        multi_col_lines = 0
        for l in stem_lines:
            tokens = l["text"].strip().split()
            # If line has 2 to 6 tokens spaced apart
            if 2 <= len(tokens) <= 6:
                multi_col_lines += 1
        if multi_col_lines >= 4:
            return True, None

    return False, None


def determine_render_mode(
    stem_text: str,
    options: List[str],
    has_image_in_stem: bool = False,
    has_image_in_options: bool = False,
    stem_lines: Optional[List[Dict[str, Any]]] = None,
    has_preamble: bool = False,
    is_table: bool = False,
) -> Tuple[str, List[str]]:
    """Determine whether question should be rendered as 'text', 'image_stem', or 'image_full'.
    
    Returns:
        (render_mode, warnings)
    """
    warnings: List[str] = []

    # Heuristic 1: Empty options (figure options where text is blank) -> image_full
    empty_opts_count = sum(1 for opt in options if len(opt.strip()) == 0)
    if empty_opts_count >= 2:
        return "image_full", warnings

    if has_image_in_options:
        return "image_full", warnings

    # Heuristic 2: Table detected in stem -> image_stem
    if is_table or TABLE_KEYWORDS_REGEX.search(stem_text):
        return "image_stem", warnings

    # Heuristic 3: Embedded image in stem -> image_stem
    if has_image_in_stem:
        return "image_stem", warnings

    # Heuristic 4: Math garble heuristics
    if has_preamble:
        return "image_stem", warnings

    # Check for shredded math: fractions, roots, complex trigonometry
    has_math_symbols = bool(MATH_SYMBOLS_REGEX.search(stem_text))
    has_trig = bool(TRIG_FUNCS_REGEX.search(stem_text))

    if has_trig and (has_math_symbols or "/" in stem_text or "∈" in stem_text):
        return "image_stem", warnings

    if "√" in stem_text and ("/" in stem_text or "θ" in stem_text or "^" in stem_text):
        return "image_stem", warnings

    if stem_lines and len(stem_lines) >= 3:
        short_lines = sum(1 for l in stem_lines if len(l["text"].strip()) <= 5)
        if short_lines >= 1 and (has_math_symbols or has_trig):
            return "image_stem", warnings

    # Fallback default: clean text
    return "text", warnings
