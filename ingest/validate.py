"""Validation and reporting for ExamQuest parsed question sets."""

from typing import Any, Dict, List


def validate_test(test_data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate a parsed test and generate a comprehensive audit report."""
    questions = test_data.get("questions", [])
    expected_count = 100
    actual_count = len(questions)

    missing_answers: List[int] = []
    invalid_answers: List[int] = []
    insufficient_options: List[int] = []
    gaps: List[int] = []
    empty_stems: List[int] = []
    low_confidence: List[int] = []

    render_mode_counts = {"text": 0, "image_stem": 0, "image_full": 0}

    seen_numbers = set()
    prev_num = 0

    for q in questions:
        n = q.get("n", 0)
        mode = q.get("render_mode", "text")
        render_mode_counts[mode] = render_mode_counts.get(mode, 0) + 1

        # Numbering check
        if n in seen_numbers or (prev_num != 0 and n != prev_num + 1):
            gaps.append(n)
        seen_numbers.add(n)
        prev_num = n

        # Answer check
        ans = q.get("answer")
        if ans is None or ans < 0 or ans > 4:
            missing_answers.append(n)

        # Options check
        opts = q.get("options", [])
        if mode == "text" and len(opts) < 2:
            insufficient_options.append(n)

        # Stem check
        stem = q.get("stem", "").strip()
        if not stem and mode == "text":
            empty_stems.append(n)

        # Confidence check
        conf = q.get("confidence", 1.0)
        if conf < 0.8:
            low_confidence.append(n)

    all_warnings_count = sum(len(q.get("warnings", [])) for q in questions)
    passed = (
        actual_count == expected_count
        and len(missing_answers) == 0
        and len(gaps) == 0
    )

    return {
        "test_id": test_data.get("id"),
        "title": test_data.get("title"),
        "total_questions": actual_count,
        "expected_questions": expected_count,
        "passed": passed,
        "render_mode_counts": render_mode_counts,
        "missing_answers": missing_answers,
        "invalid_answers": invalid_answers,
        "insufficient_options": insufficient_options,
        "numbering_gaps": gaps,
        "empty_stems": empty_stems,
        "low_confidence_questions": low_confidence,
        "total_warnings": all_warnings_count,
    }
