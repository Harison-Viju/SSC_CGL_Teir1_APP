"""Markdown documentation generator for ExamQuest parsed tests."""

from typing import Any, Dict


def generate_test_doc(test_data: Dict[str, Any], validation_report: Dict[str, Any]) -> str:
    """Generate Markdown documentation for an ingested test."""
    test_id = test_data.get("id", "test")
    title = test_data.get("title", "Exam Test")
    exam = test_data.get("exam", "Exam")
    date = test_data.get("date", "Unknown")
    questions = test_data.get("questions", [])
    sections = test_data.get("sections", [])
    render_counts = validation_report.get("render_mode_counts", {})

    lines = [
        f"# {title}",
        "",
        "## Source",
        f"- **File:** `{test_data.get('source_file')}`",
        f"- **SHA-256:** `{test_data.get('source_sha256')}`",
        f"- **Exam:** {exam}",
        f"- **Date:** {date}",
        f"- **Shift:** {test_data.get('shift') or 'Standard'}",
        f"- **Duration:** {test_data.get('duration_minutes')} minutes",
        f"- **Marking Scheme:** +{test_data.get('marking', {}).get('correct', 2)} for correct, {test_data.get('marking', {}).get('wrong', -0.5)} for wrong",
        "",
        "## Summary",
        f"- **Total Questions:** {len(questions)}",
        f"- **Text Mode Questions:** {render_counts.get('text', 0)}",
        f"- **Stem Image Questions:** {render_counts.get('image_stem', 0)}",
        f"- **Full Image Questions:** {render_counts.get('image_full', 0)}",
        f"- **Validation Passed:** {'✅ Yes' if validation_report.get('passed') else '❌ Needs Review'}",
        f"- **Total Warnings:** {validation_report.get('total_warnings', 0)}",
        "",
        "## Sections",
        "| Section ID | Section Name | Questions | Time |",
        "|---|---|---|---|",
    ]

    for sec in sections:
        q_count = sum(1 for q in questions if q.get("section") == sec.get("id"))
        lines.append(f"| `{sec.get('id')}` | {sec.get('name')} | Q{sec.get('from')}–Q{sec.get('to')} ({q_count} items) | {sec.get('duration_minutes')} min |")

    # Topic distribution
    topic_counts: Dict[str, int] = {}
    for q in questions:
        t = q.get("topic", "General")
        topic_counts[t] = topic_counts.get(t, 0) + 1

    lines.extend([
        "",
        "## Topic Distribution",
        "| Topic | Questions |",
        "|---|---|",
    ])
    for topic, count in sorted(topic_counts.items(), key=lambda x: x[1], reverse=True):
        lines.append(f"| {topic} | {count} |")

    # Warnings
    flagged = [q for q in questions if q.get("warnings")]
    lines.extend([
        "",
        "## Warnings & Manual Review Needed",
    ])
    if flagged:
        for q in flagged:
            lines.append(f"- **Q{q.get('n')}:** {', '.join(q.get('warnings', []))}")
    else:
        lines.append("No critical parser warnings detected.")

    # Answer Key Table
    lines.extend([
        "",
        "## Answer Key (Compact)",
        "| Q | Ans | Q | Ans | Q | Ans | Q | Ans |",
        "|---|---|---|---|---|---|---|---|",
    ])
    letter_map = {0: "A", 1: "B", 2: "C", 3: "D", 4: "E"}
    for r in range(25):
        row_cells = []
        for col in range(4):
            q_idx = r + col * 25
            if q_idx < len(questions):
                q = questions[q_idx]
                ans_str = letter_map.get(q.get("answer"), "?")
                row_cells.append(f"**Q{q.get('n')}** | {ans_str}")
            else:
                row_cells.append("- | -")
        lines.append(f"| {' | '.join(row_cells)} |")

    lines.append("")
    return "\n".join(lines)
