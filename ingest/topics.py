"""Rule-based topic tagging for questions using configurable regex rules."""

import os
import re
from typing import Any, Dict, List, Optional, Tuple
import yaml


FALLBACK_BY_SECTION = {
    "reasoning": "Other Reasoning",
    "general_awareness": "Static GK",
    "quantitative_aptitude": "Number System",
    "english": "Reading Comprehension",
}


class TopicClassifier:
    """Classifies questions into topics using configurable regex rules."""

    def __init__(self, rules_path: Optional[str] = None):
        self.rules: List[Dict[str, str]] = []
        if rules_path and os.path.exists(rules_path):
            with open(rules_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
                self.rules = data.get("rules", [])

    def classify_with_meta(
        self,
        text: str,
        section_id: Optional[str] = None,
        render_mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Classify question text with confidence/specificity diagnostic metadata."""
        # Normalize ligatures and spacing common in extracted PDF text
        clean_text = (
            text.replace("\ue020", "f")
            .replace("\ue021", "fi")
            .replace("\ue022", "fl")
            .replace("\ue023", "ffi")
            .replace("\ue024", "ffl")
            .strip()
        )

        # Rule 2: Rule that the topic MUST belong to the question's section
        if section_id == "reasoning" and render_mode == "image_full":
            # Check specific non-series visual figure types first
            for rule in self.rules:
                if rule.get("section") == "reasoning" and rule["topic"] in [
                    "Mirror & Water Image",
                    "Paper Folding & Cutting",
                    "Embedded Figures",
                    "Cube & Dice",
                ]:
                    m = re.search(rule["pattern"], clean_text, re.DOTALL | re.IGNORECASE)
                    if m:
                        return {
                            "topic": rule["topic"],
                            "matched_pattern": rule["pattern"],
                            "matched_text": m.group(0),
                            "weak": False,
                            "fallback": False,
                        }

            # Rule 2: if render_mode is image_full and stem contains series or figure in reasoning
            if re.search(r"(?i)\b(series|figure)\b", clean_text) or not clean_text:
                return {
                    "topic": "Figure Series",
                    "matched_pattern": "image_full + series/figure heuristic",
                    "matched_text": "image_full",
                    "weak": False,
                    "fallback": False,
                }

        # Match against taxonomy rules for the question's section
        if section_id:
            for rule in self.rules:
                if rule.get("section") == section_id:
                    m = re.search(rule["pattern"], clean_text, re.DOTALL | re.IGNORECASE)
                    if m:
                        matched_str = m.group(0)
                        # Identify weak matches: single matched word <= 4 chars
                        is_weak = len(matched_str.strip().split()) == 1 and len(matched_str.strip()) <= 4
                        return {
                            "topic": rule["topic"],
                            "matched_pattern": rule["pattern"],
                            "matched_text": matched_str,
                            "weak": is_weak,
                            "fallback": False,
                        }

        # Section-specific fallback as required (never pick from another section)
        fallback_topic = FALLBACK_BY_SECTION.get(section_id or "", "General")
        return {
            "topic": fallback_topic,
            "matched_pattern": "fallback",
            "matched_text": "",
            "weak": True,
            "fallback": True,
        }

    def classify(
        self,
        text: str,
        section_id: Optional[str] = None,
        render_mode: Optional[str] = None,
    ) -> str:
        """Find the best matching topic for the given question text."""
        res = self.classify_with_meta(text, section_id=section_id, render_mode=render_mode)
        return res["topic"]
