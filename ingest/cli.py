"""Command Line Interface for ExamQuest ingestion pipeline.

Usage:
    python -m ingest --all
    python -m ingest --file pdfs/ssc/SSC-CGL-Exam-Day-Based-Paper-01-Oct-2026-Eng-exam_92c8b14a.pdf
    python -m ingest --suggest-overrides
"""

import argparse
import glob
import json
import os
import sys
from typing import Any, Dict, List, Optional

from .layout import load_profile
from .parser import ExamParser
from .cropper import QuestionCropper
from .validate import validate_test
from .docs import generate_test_doc


def load_overrides(test_id: str, overrides_dir: str = "overrides") -> Dict[str, Any]:
    """Load manual question overrides for a specific test if file exists."""
    override_file = os.path.join(overrides_dir, f"{test_id}.json")
    if os.path.exists(override_file):
        try:
            with open(override_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[Warning] Failed to load overrides from {override_file}: {e}")
    return {}


def load_cache(output_dir: str) -> Dict[str, str]:
    """Load SHA-256 cache from public/data/.ingest-cache.json."""
    cache_path = os.path.join(output_dir, ".ingest-cache.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_cache(cache: Dict[str, str], output_dir: str):
    """Save SHA-256 cache to public/data/.ingest-cache.json."""
    cache_path = os.path.join(output_dir, ".ingest-cache.json")
    try:
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
    except Exception as e:
        print(f"[Warning] Could not save cache: {e}")


def process_pdf(
    pdf_path: str,
    profile_path: str,
    topics_path: str,
    output_dir: str,
    docs_dir: str,
    overrides_dir: str = "overrides",
    force: bool = False,
    cache: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Process a single PDF file, crop figures to WebP, and generate JSON artifacts."""
    profile = load_profile(profile_path)
    parser = ExamParser(profile, topics_path)
    file_sha256 = parser.compute_sha256(pdf_path)

    # Check cache if not forced
    if cache is not None and not force and cache.get(pdf_path) == file_sha256:
        print(f"[Ingest] Skipping (cached): {pdf_path}")
        # Read existing test json to return entry
        test_id_guess = os.path.splitext(os.path.basename(pdf_path))[0].lower()
        candidates = glob.glob(os.path.join(output_dir, "tests", "*.json"))
        for c in candidates:
            if not c.endswith(".report.json"):
                with open(c, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                    if cached_data.get("source_sha256") == file_sha256:
                        return make_manifest_entry(cached_data, pdf_path)

    print(f"\n[Ingest] Processing: {pdf_path}")
    test_data = parser.parse_pdf(pdf_path)
    test_id = test_data["id"]

    # 1. Apply overrides if present
    overrides = load_overrides(test_id, overrides_dir)
    if overrides:
        print(f"[Ingest] Applying {len(overrides)} override(s) from {overrides_dir}/{test_id}.json")
        for q in test_data["questions"]:
            qn_str = str(q["n"])
            if qn_str in overrides:
                patch = overrides[qn_str]
                for k, v in patch.items():
                    if k != "n":
                        q[k] = v

    # 2. Crop figures for questions where render_mode is not 'text'
    cropper = QuestionCropper(pdf_path, scale=2.5, quality=85)
    img_dir = os.path.join(output_dir, "img", test_id)
    image_count = 0

    for q in test_data["questions"]:
        mode = q.get("render_mode", "text")
        if mode in ("image_stem", "image_full"):
            crop_results = cropper.crop_question(q, img_dir, test_id)
            q["stem_image"] = crop_results.get("stem_image")
            q["full_image"] = crop_results.get("full_image")
            image_count += 1

    print(f"[Ingest] Generated {image_count} high-resolution WebP figure crops in {img_dir}")

    # 3. Validation & Reporting
    report = validate_test(test_data)
    tests_out_dir = os.path.join(output_dir, "tests")
    os.makedirs(tests_out_dir, exist_ok=True)
    os.makedirs(docs_dir, exist_ok=True)

    test_json_path = os.path.join(tests_out_dir, f"{test_id}.json")
    with open(test_json_path, "w", encoding="utf-8") as f:
        json.dump(test_data, f, indent=2, ensure_ascii=False)

    report_json_path = os.path.join(tests_out_dir, f"{test_id}.report.json")
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    doc_md = generate_test_doc(test_data, report)
    doc_path = os.path.join(docs_dir, f"{test_id}.md")
    with open(doc_path, "w", encoding="utf-8") as f:
        f.write(doc_md)

    if cache is not None:
        cache[pdf_path] = file_sha256

    print(f"[Ingest] Saved test JSON: {test_json_path}")
    print(f"[Ingest] Render modes: {report['render_mode_counts']}")
    print(f"[Ingest] Validation: {'PASSED' if report['passed'] else 'FAILED'}")

    return make_manifest_entry(test_data, pdf_path, report.get("passed", True))


def make_manifest_entry(test_data: Dict[str, Any], pdf_path: str, passed: bool = True) -> Dict[str, Any]:
    """Create lightweight manifest entry for instant library loading."""
    questions = test_data.get("questions", [])
    render_counts = {}
    for q in questions:
        m = q.get("render_mode", "text")
        render_counts[m] = render_counts.get(m, 0) + 1

    return {
        "id": test_data["id"],
        "title": test_data["title"],
        "exam": test_data["exam"],
        "date": test_data["date"],
        "shift": test_data.get("shift"),
        "duration_minutes": test_data.get("duration_minutes", 60),
        "total_questions": len(questions),
        "marking": test_data.get("marking", {"correct": 2.0, "wrong": -0.5, "unanswered": 0.0}),
        "sections": [
            {
                "id": s["id"],
                "name": s["name"],
                "count": sum(1 for q in questions if q.get("section") == s["id"]),
                "duration_minutes": s.get("duration_minutes", 15),
            }
            for s in test_data.get("sections", [])
        ],
        "render_mode_counts": render_counts,
        "passed": passed,
        "source_file": pdf_path,
    }


def update_manifest(manifest_entries: List[Dict[str, Any]], output_dir: str):
    """Write public/data/manifest.json containing all tests."""
    manifest_path = os.path.join(output_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"tests": manifest_entries, "updated_at": "2026-10-25T07:00:00Z"}, f, indent=2)
    print(f"[Ingest] Updated manifest with {len(manifest_entries)} test(s) at {manifest_path}")


def generate_index_doc(manifest_entries: List[Dict[str, Any]], docs_dir: str):
    """Generate top-level docs/INDEX.md cataloging all processed papers."""
    lines = [
        "# ExamQuest Question Papers Index",
        "",
        "Welcome to the catalog of automatically ingested exam papers in ExamQuest.",
        "",
        "| Test Title | Exam | Date | Questions | Status | Documentation |",
        "|---|---|---|---|---|---|",
    ]
    for e in manifest_entries:
        status = "✅ Verified" if e.get("passed") else "⚠️ Check Warnings"
        doc_link = f"[{e['id']}](tests/{e['id']}.md)"
        lines.append(f"| {e['title']} | {e['exam']} | {e['date']} | {e['total_questions']} | {status} | {doc_link} |")

    lines.append("")
    index_path = os.path.join(os.path.dirname(docs_dir), "INDEX.md")
    os.makedirs(os.path.dirname(index_path), exist_ok=True)
    with open(index_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"[Ingest] Generated catalog index at {index_path}")


def suggest_overrides(tests_dir: str = "public/data/tests"):
    """Find low-confidence or warned questions and print a ready-to-use overrides template."""
    report_files = glob.glob(os.path.join(tests_dir, "*.report.json"))
    if not report_files:
        print("[Suggest] No reports found. Run ingestion first.")
        return

    for rf in report_files:
        with open(rf, "r", encoding="utf-8") as f:
            report = json.load(f)
        
        test_id = report.get("test_id")
        low_conf = report.get("low_confidence_questions", [])
        missing = report.get("missing_answers", [])
        flagged = set(low_conf + missing)
        
        if not flagged:
            print(f"[Suggest] Test {test_id}: All questions passed with high confidence. No overrides needed.")
            continue

        print(f"\n--- Suggested overrides template for: overrides/{test_id}.json ---")
        skeleton = {}
        for qn in sorted(flagged):
            skeleton[str(qn)] = {
                "answer": 0,
                "render_mode": "text",
                "note": "Review and update this question if needed",
            }
        print(json.dumps(skeleton, indent=2))


def main():
    parser = argparse.ArgumentParser(description="ExamQuest PDF Question Ingestion")
    parser.add_argument("--all", action="store_true", help="Process all PDFs in pdfs/")
    parser.add_argument("--file", type=str, help="Process a single specific PDF file")
    parser.add_argument("--profile", type=str, default="profiles/ssc_cgl_tier1.yaml", help="Path to profile YAML")
    parser.add_argument("--topics", type=str, default="profiles/topics.yaml", help="Path to topics YAML")
    parser.add_argument("--output", type=str, default="public/data", help="Output data directory")
    parser.add_argument("--docs", type=str, default="docs/tests", help="Output docs directory")
    parser.add_argument("--force", action="store_true", help="Force re-processing bypassing cache")
    parser.add_argument("--suggest-overrides", action="store_true", help="Generate skeleton overrides for flagged questions")
    args = parser.parse_args()

    if args.suggest_overrides:
        suggest_overrides(os.path.join(args.output, "tests"))
        return

    pdf_files: List[str] = []
    if args.file:
        pdf_files = [args.file]
    else:
        pdf_files = sorted(glob.glob("pdfs/**/*.pdf", recursive=True))

    if not pdf_files:
        print("[Ingest] No PDF files found to process.")
        sys.exit(0)

    cache = load_cache(args.output)
    manifest_entries: List[Dict[str, Any]] = []

    for pdf_file in pdf_files:
        entry = process_pdf(
            pdf_file,
            args.profile,
            args.topics,
            args.output,
            args.docs,
            force=args.force,
            cache=cache,
        )
        manifest_entries.append(entry)

    save_cache(cache, args.output)
    update_manifest(manifest_entries, args.output)
    generate_index_doc(manifest_entries, args.docs)


if __name__ == "__main__":
    main()
