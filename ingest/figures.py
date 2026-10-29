"""Figure and render_mode analysis for ExamQuest questions."""

import re
from typing import Any, Dict, List, Optional, Tuple


# Known question numbers in sample that are figure/math based
MATH_SYMBOLS_REGEX = re.compile(r"[√²³⁴∈θ×÷±≠≤≥π∫∂∑∆△]")
TRIG_FUNCS_REGEX = re.compile(r"\b(sin|cos|tan|cot|sec|cosec)\b", re.IGNORECASE)
TABLE_KEYWORDS_REGEX = re.compile(r"\b(Matrix-[I|V|X]+|Table\s*[-–]|S\.No\s+Factory|Column\s+[I|V|X]+)\b", re.IGNORECASE)


def determine_render_mode(
    stem_text: str,
    options: List[str],
    has_image_in_stem: bool = False,
    has_image_in_options: bool = False,
    stem_lines: Optional[List[Dict[str, Any]]] = None,
    has_preamble: bool = False,
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

    # Heuristic 2: Table or matrix in stem -> image_stem
    if TABLE_KEYWORDS_REGEX.search(stem_text):
        return "image_stem", warnings

    # Heuristic 3: Embedded image in stem -> image_stem
    if has_image_in_stem:
        return "image_stem", warnings

    # Heuristic 4: Math garble heuristics
    # Any question with elevated preambles (floating numerators)
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
