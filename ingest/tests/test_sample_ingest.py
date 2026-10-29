"""Pytest test suite verifying Section 3.4 acceptance criteria for the sample PDF."""

import os
import pytest
from ingest.layout import load_profile
from ingest.parser import ExamParser
from ingest.validate import validate_test

SAMPLE_PDF = "pdfs/ssc/SSC-CGL-Exam-Day-Based-Paper-01-Oct-2026-Eng-exam_92c8b14a.pdf"
PROFILE_PATH = "profiles/ssc_cgl_tier1.yaml"
TOPICS_PATH = "profiles/topics.yaml"


@pytest.fixture(scope="module")
def parsed_data():
    """Parse the sample PDF once for test suite."""
    assert os.path.exists(SAMPLE_PDF), f"Sample PDF not found at {SAMPLE_PDF}"
    profile = load_profile(PROFILE_PATH)
    parser = ExamParser(profile, TOPICS_PATH)
    return parser.parse_pdf(SAMPLE_PDF)


def test_question_count_and_numbering(parsed_data):
    """Requirement: Finds exactly 100 questions, numbered 1-100 with no gaps, and 100 answers."""
    questions = parsed_data["questions"]
    assert len(questions) == 100, f"Expected 100 questions, got {len(questions)}"
    
    numbers = [q["n"] for q in questions]
    assert numbers == list(range(1, 101)), "Questions must be sequentially numbered 1 to 100 without gaps"

    # Verify each has an answer index 0..3 (representing a..d)
    for q in questions:
        assert q["answer"] is not None, f"Q{q['n']} missing answer"
        assert 0 <= q["answer"] <= 3, f"Q{q['n']} has invalid answer index {q['answer']}"


def test_page_break_split_answers(parsed_data):
    """Requirement: Q7 answer = b, Q22 answer = b (landed at top of next page), Q62 = a, Q66 = b."""
    letter_map = {0: "a", 1: "b", 2: "c", 3: "d"}
    qs = {q["n"]: q for q in parsed_data["questions"]}

    assert letter_map[qs[7]["answer"]] == "b", f"Expected Q7 ans 'b', got {letter_map.get(qs[7]['answer'])}"
    assert letter_map[qs[22]["answer"]] == "b", f"Expected Q22 ans 'b', got {letter_map.get(qs[22]['answer'])}"
    assert letter_map[qs[62]["answer"]] == "a", f"Expected Q62 ans 'a', got {letter_map.get(qs[62]['answer'])}"
    assert letter_map[qs[66]["answer"]] == "b", f"Expected Q66 ans 'b', got {letter_map.get(qs[66]['answer'])}"


def test_figure_questions_classification(parsed_data):
    """Requirement: Q1, Q3, Q9, Q13, Q14, Q24 are image_full or image_stem."""
    qs = {q["n"]: q for q in parsed_data["questions"]}

    for qn in [1, 3, 9, 13, 24]:
        assert qs[qn]["render_mode"] == "image_full", f"Q{qn} should be image_full, got {qs[qn]['render_mode']}"

    assert qs[14]["render_mode"] in ("image_stem", "image_full"), f"Q14 should be image_stem or image_full, got {qs[14]['render_mode']}"


def test_math_garble_questions(parsed_data):
    """Requirement: Q52, Q53, Q55 are image_stem."""
    qs = {q["n"]: q for q in parsed_data["questions"]}

    for qn in [52, 53, 55]:
        assert qs[qn]["render_mode"] == "image_stem", f"Q{qn} should be image_stem, got {qs[qn]['render_mode']}"


def test_tables_classification(parsed_data):
    """Requirement: Q21 and Q56 (tables/matrices) are image_stem."""
    qs = {q["n"]: q for q in parsed_data["questions"]}

    assert qs[21]["render_mode"] == "image_stem", f"Q21 should be image_stem, got {qs[21]['render_mode']}"
    assert qs[56]["render_mode"] == "image_stem", f"Q56 should be image_stem, got {qs[56]['render_mode']}"


def test_passage_attached_to_range(parsed_data):
    """Requirement: Q77-Q81 share the passage p77-81."""
    qs = {q["n"]: q for q in parsed_data["questions"]}
    passages = parsed_data.get("passages", [])
    
    assert len(passages) >= 1, "Must detect at least 1 passage"
    p_ids = [p["id"] for p in passages]
    assert "p77-81" in p_ids, f"Expected passage p77-81 in {p_ids}"

    for qn in range(77, 82):
        assert qs[qn]["passage_id"] == "p77-81", f"Q{qn} should be attached to passage p77-81"


def test_sections_ranges(parsed_data):
    """Requirement: Section ranges 1-25 / 26-50 / 51-75 / 76-100 are assigned correctly."""
    questions = parsed_data["questions"]

    for q in questions:
        n = q["n"]
        sec = q["section"]
        if 1 <= n <= 25:
            assert sec == "reasoning", f"Q{n} should be in reasoning section, got {sec}"
        elif 26 <= n <= 50:
            assert sec == "general_awareness", f"Q{n} should be in general_awareness section, got {sec}"
        elif 51 <= n <= 75:
            assert sec == "quantitative_aptitude", f"Q{n} should be in quantitative_aptitude section, got {sec}"
        elif 76 <= n <= 100:
            assert sec == "english", f"Q{n} should be in english section, got {sec}"


def test_validation_report_passed(parsed_data):
    """Requirement: Test report passes validation with no missing answers and zero numbering gaps."""
    report = validate_test(parsed_data)
    assert report["passed"] is True
    assert report["total_questions"] == 100
    assert len(report["missing_answers"]) == 0
    assert len(report["numbering_gaps"]) == 0


def test_webp_image_crops_generated():
    """Phase 2 Requirement: WebP image crops exist, are valid, and under 150 KB."""
    test_json_path = "public/data/tests/ssc-cgl-2026-10-01.json"
    assert os.path.exists(test_json_path), "Test JSON file must exist"
    
    import json
    from PIL import Image

    with open(test_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    image_questions = [q for q in data["questions"] if q.get("render_mode") in ("image_stem", "image_full")]
    assert len(image_questions) >= 10, f"Expected at least 10 image questions, found {len(image_questions)}"

    for q in image_questions:
        mode = q["render_mode"]
        if mode == "image_stem":
            img_rel = q.get("stem_image")
            assert img_rel, f"Q{q['n']} (image_stem) missing stem_image reference"
        else:
            img_rel = q.get("full_image")
            assert img_rel, f"Q{q['n']} (image_full) missing full_image reference"

        img_abs = os.path.join("public/data", img_rel)
        assert os.path.exists(img_abs), f"File {img_abs} does not exist on disk"
        size_kb = os.path.getsize(img_abs) / 1024
        assert size_kb <= 150.0, f"Image {img_abs} size ({size_kb:.1f} KB) exceeds 150 KB"

        # Verify image opens with PIL
        with Image.open(img_abs) as im:
            assert im.width > 50
            assert im.height > 10


def test_overrides_application(tmp_path):
    """Phase 2 Requirement: overrides/<test_id>.json can patch any field of any question."""
    from ingest.cli import load_overrides
    import json

    overrides_dir = tmp_path / "overrides"
    overrides_dir.mkdir()
    override_file = overrides_dir / "test-sample.json"

    patch_data = {
        "1": {"answer": 3, "topic": "Custom Topic", "note": "Manual review fix"}
    }
    with open(override_file, "w") as f:
        json.dump(patch_data, f)

    loaded = load_overrides("test-sample", str(overrides_dir))
    assert loaded["1"]["answer"] == 3
    assert loaded["1"]["topic"] == "Custom Topic"


def test_parser_idempotency():
    """Requirement: Re-running produces identical output (idempotency)."""
    profile = load_profile(PROFILE_PATH)
    parser = ExamParser(profile, TOPICS_PATH)
    run1 = parser.parse_pdf(SAMPLE_PDF)
    run2 = parser.parse_pdf(SAMPLE_PDF)

    assert run1["id"] == run2["id"]
    assert run1["source_sha256"] == run2["source_sha256"]
    assert len(run1["questions"]) == len(run2["questions"])
    for q1, q2 in zip(run1["questions"], run2["questions"]):
        assert q1["n"] == q2["n"]
        assert q1["answer"] == q2["answer"]
        assert q1["render_mode"] == q2["render_mode"]
        assert q1["options"] == q2["options"]
        assert q1["stem"] == q2["stem"]
        assert q1.get("blocks") == q2.get("blocks")


def test_line_break_preservation_and_blocks(parsed_data):
    """Bug Fix Round Requirement: Q20 preserves line-breaks and semantic blocks structure."""
    qs = {q["n"]: q for q in parsed_data["questions"]}

    # Q20 Acceptance: STATEMENT block, then Inference I, II, III as three separate rows
    q20 = qs[20]
    assert "\n" in q20["stem"], "Q20 stem must preserve newlines"
    assert "blocks" in q20, "Q20 must contain structured blocks"
    
    b_types = [b["type"] for b in q20["blocks"]]
    assert "label" in b_types, "Q20 blocks must contain labels"
    assert "list_item" in b_types, "Q20 blocks must contain list items"

    q20_labels = [b["text"].lower() for b in q20["blocks"] if b["type"] == "label"]
    assert "statement" in q20_labels
    assert "inference" in q20_labels

    q20_items = [b for b in q20["blocks"] if b["type"] == "list_item"]
    assert len(q20_items) == 3, f"Expected 3 inference items, got {len(q20_items)}"
    assert [item["marker"] for item in q20_items] == ["I.", "II.", "III."]

    # Q4: Statement and Conclusions with I. and II.
    q4 = qs[4]
    assert "\n" in q4["stem"]
    q4_items = [b for b in q4["blocks"] if b["type"] == "list_item"]
    assert len(q4_items) == 2
    assert [item["marker"] for item in q4_items] == ["I.", "II."]

    # Q88 and Q92 list questions
    q88 = qs[88]
    q88_items = [b for b in q88["blocks"] if b["type"] == "list_item"]
    assert len(q88_items) == 3

    q92 = qs[92]
    q92_items = [b for b in q92["blocks"] if b["type"] == "list_item"]
    assert len(q92_items) == 4


