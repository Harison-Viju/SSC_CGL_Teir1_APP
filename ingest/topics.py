"""Rule-based topic tagging for questions using regex rules."""

import os
import re
from typing import Any, Dict, List, Optional
import yaml


class TopicClassifier:
    """Classifies questions into topics using configurable regex rules."""

    def __init__(self, rules_path: Optional[str] = None):
        self.rules: List[Dict[str, str]] = []
        if rules_path and os.path.exists(rules_path):
            with open(rules_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
                self.rules = data.get("rules", [])

    def classify(self, text: str, section_id: Optional[str] = None) -> str:
        """Find the best matching topic for the given question text."""
        # First priority: matching section rule
        if section_id:
            for rule in self.rules:
                if rule.get("section") == section_id:
                    if re.search(rule["pattern"], text):
                        return rule["topic"]

        # Second priority: general rule
        for rule in self.rules:
            if re.search(rule["pattern"], text):
                return rule["topic"]

        return "General"
