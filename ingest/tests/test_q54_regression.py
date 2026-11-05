"""Regression tests for Q54 table detection, option parsing, and quality validation."""

import os
import json
import pytest
from ingest.layout import load_profile
from ingest.parser import ExamParser

OCT_05_PDF = "pdfs/ssc/SSC-CGL-Exam-Day-Based-Paper-05-Oct-2026_8ae81164.pdf"
PROFILE_PATH = "profiles/ssc_cgl_tier1.yaml"
TOPICS_PATH = "profiles/topics.yaml"


@pytest.fixture(scope="module")
def parsed_oct05_data():
    """Parse the 05-Oct-2026 PDF."""
    assert os.path.exists(OCT_05_PDF), f"PDF not found at {OCT_05_PDF}"
    profile = load_profile(PROFILE_PATH)
    parser = ExamParser(profile, TOPICS_PATH)
    return parser.parse_pdf(OCT_05_PDF)


def test_q54_table_detection_and_options(parsed_oct05_data):
    """Test Q54 in ssc-cgl-2026-10-05:
    - Table of 'No of Students' and 'Age of the Students' must be detected
    - Option A ('7') must not be merged into the stem
    - Exactly 4 options: ['7', '6', '5', '8']
    - Answer index must be 0 ('7')
    - render_mode must be 'image_stem'
    """
    qs = {q["n"]: q for q in parsed_oct05_data["questions"]}
    q54 = qs[54]

    assert q54["render_mode"] == "image_stem", f"Expected image_stem, got {q54['render_mode']}"
    assert q54["table"] is not None, "Q54 table should be detected"
    assert q54["table"]["headers"] == ["No of Students", "Age of the Students"]
    assert len(q54["table"]["rows"]) >= 5
    assert q54["table"]["rows"][0] == ["8", "8"]

    # Verify options: exactly 4 options, A = 7, B = 6, C = 5, D = 8
    assert len(q54["options"]) == 4, f"Expected 4 options, got {len(q54['options'])}"
    assert q54["options"] == ["7", "6", "5", "8"], f"Options mismatch: {q54['options']}"
    assert q54["answer"] == 0, f"Expected answer 0, got {q54['answer']}"

    # Verify stem does NOT contain stray option marker 'A. 7'
    assert "A. 7" not in q54["stem"], "Stray option marker 'A. 7' should not be left in stem"
    assert "A." not in [b.get("marker") for b in (q54.get("blocks") or []) if b.get("type") == "list_item"]

    # Verify confidence and warnings
    assert q54["confidence"] >= 0.95
    assert len(q54["warnings"]) == 0


def test_q54_saved_json_artifact():
    """Verify generated JSON file public/data/tests/ssc-cgl-2026-10-05.json has correct Q54."""
    json_path = "public/data/tests/ssc-cgl-2026-10-05.json"
    assert os.path.exists(json_path), f"JSON file missing at {json_path}"

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    q54 = next(q for q in data["questions"] if q["n"] == 54)
    assert q54["render_mode"] == "image_stem"
    assert q54["options"] == ["7", "6", "5", "8"]
    assert q54["answer"] == 0
    assert q54["section"] == "quantitative_aptitude"
    assert q54["table"] is not None
