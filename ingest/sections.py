"""Section mapping for questions based on profile definition."""

from typing import Any, Dict, List, Optional


def get_section_for_question(q_num: int, sections: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Find the matching section for a given 1-based question number."""
    for sec in sections:
        if sec.get("from", 1) <= q_num <= sec.get("to", 9999):
            return sec
    return {
        "id": "general",
        "name": "General",
        "from": q_num,
        "to": q_num,
        "duration_minutes": 15,
    }
