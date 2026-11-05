"""Pytest test suite verifying Section 3.4 & P0 Topic Classification acceptance criteria."""

import glob
import json
import os
import pytest
import yaml

from ingest.topics import TopicClassifier

TOPICS_YAML = "profiles/topics.yaml"
OCT_01_TEST_JSON = "public/data/tests/ssc-cgl-2026-10-01.json"


@pytest.fixture(scope="module")
def taxonomy_by_section():
    assert os.path.exists(TOPICS_YAML), f"Topics YAML missing at {TOPICS_YAML}"
    with open(TOPICS_YAML, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    
    sec_topics = {}
    for rule in data.get("rules", []):
        sec = rule["section"]
        top = rule["topic"]
        sec_topics.setdefault(sec, set()).add(top)

    # Add section-specific fallbacks if any
    sec_topics.setdefault("reasoning", set()).add("Other Reasoning")
    sec_topics.setdefault("general_awareness", set()).add("Other General Awareness")
    sec_topics.setdefault("quantitative_aptitude", set()).add("Other Quantitative Aptitude")
    sec_topics.setdefault("english", set()).add("Other English")
    return sec_topics


def test_q3_and_q9_figure_series():
    """Requirement: Q3 and Q9 of ssc-cgl-2026-10-01 are 'Figure Series'."""
    assert os.path.exists(OCT_01_TEST_JSON), f"Test JSON missing at {OCT_01_TEST_JSON}"
    with open(OCT_01_TEST_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    qs = {q["n"]: q for q in data["questions"]}
    assert qs[3]["topic"] == "Figure Series", f"Q3 expected 'Figure Series', got {qs[3]['topic']}"
    assert qs[9]["topic"] == "Figure Series", f"Q9 expected 'Figure Series', got {qs[9]['topic']}"


def test_all_questions_have_topic_from_own_section(taxonomy_by_section):
    """Requirement: Every question across all papers has a topic from its own section."""
    test_files = sorted(glob.glob("public/data/tests/*.json"))
    test_files = [f for f in test_files if not f.endswith(".report.json")]
    assert len(test_files) == 12, f"Expected 12 test files, found {len(test_files)}"

    invalid_assignments = []
    for tf in test_files:
        with open(tf, "r", encoding="utf-8") as f:
            data = json.load(f)
        test_id = data.get("id", os.path.basename(tf))
        for q in data.get("questions", []):
            sec = q.get("section")
            top = q.get("topic")
            allowed = taxonomy_by_section.get(sec, set())
            if top not in allowed:
                invalid_assignments.append(
                    f"{test_id} Q{q.get('n')}: section '{sec}' has illegal topic '{top}'"
                )

    assert not invalid_assignments, (
        f"Found {len(invalid_assignments)} questions with topics outside their own section:\n"
        + "\n".join(invalid_assignments[:20])
    )


def test_topic_override_support():
    """Requirement: Support topic overrides in overrides/<test_id>.json (field 'topic')."""
    from ingest.layout import load_profile
    from ingest.parser import ExamParser

    profile = load_profile("profiles/ssc_cgl_tier1.yaml")
    parser = ExamParser(profile, "profiles/topics.yaml")

    # Mock override on question 54
    mock_overrides = {
        "54": {
            "topic": "Custom Manual Topic"
        }
    }
    data = parser.parse_pdf("pdfs/ssc/SSC-CGL-Exam-Day-Based-Paper-05-Oct-2026_8ae81164.pdf", overrides=mock_overrides)
    q54 = next(q for q in data["questions"] if q["n"] == 54)
    assert q54["topic"] == "Custom Manual Topic", f"Override topic not applied: {q54['topic']}"
