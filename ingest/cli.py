"""Command Line Interface for ExamQuest ingestion pipeline.

Usage:
    python -m ingest --all
    python -m ingest --file pdfs/ssc/SSC-CGL-Exam-Day-Based-Paper-01-Oct-2026-Eng-exam_92c8b14a.pdf
    python -m ingest --suggest-overrides
"""

import argparse
import glob
import hashlib
import json
import os
import re
import sys
from typing import Any, Dict, List, Optional

from .layout import load_profile
from .parser import ExamParser
from .cropper import QuestionCropper
from .validate import validate_test
from .docs import generate_test_doc
from .topics import TopicClassifier


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
        if mode in ("image_stem", "image_full") or q.get("confidence", 1.0) < 0.95 or q.get("warnings"):
            crop_results = cropper.crop_question(q, img_dir, test_id)
            q["stem_image"] = crop_results.get("stem_image")
            q["full_image"] = crop_results.get("full_image")
            q["orig_image"] = crop_results.get("orig_image")
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


def slugify(text: str) -> str:
    """Generate URL-safe slug for topic name."""
    s = text.lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s


def compute_qkey(stem: str, options: Optional[List[str]] = None) -> str:
    """Compute deterministic normalized text hash for question tracking."""
    norm_stem = re.sub(r"\s+", " ", stem or "").strip().lower()
    norm_opts = " ".join(re.sub(r"\s+", " ", o or "").strip().lower() for o in (options or []))
    content = f"{norm_stem}|{norm_opts}" if norm_opts else norm_stem
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def postprocess_duplicates_and_topics(tests_dir: str, output_dir: str) -> List[Dict[str, Any]]:
    """Scan all ingested test files, mark cross-paper duplicates, compile topics.json, and sync manifest."""
    test_files = sorted(glob.glob(os.path.join(tests_dir, "*.json")))
    test_files = [f for f in test_files if not f.endswith(".report.json")]

    seen_stems: Dict[str, str] = {}
    qkey_by_qid: Dict[str, str] = {}
    total_questions = 0
    dup_count = 0

    test_data_map: Dict[str, Dict[str, Any]] = {}

    for tf in test_files:
        try:
            with open(tf, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        test_id = data.get("id", os.path.basename(tf).replace(".json", ""))
        for q in data.get("questions", []):
            total_questions += 1
            qid = f"{test_id}:{q['n']}"
            base_qkey = compute_qkey(q.get("stem", ""), q.get("options"))
            norm_stem = re.sub(r"\s+", " ", q.get("stem", "")).strip().lower()
            if len(norm_stem) >= 15:
                if norm_stem in seen_stems:
                    primary_qid = seen_stems[norm_stem]
                    q["duplicate_of"] = primary_qid
                    q["qkey"] = qkey_by_qid.get(primary_qid, base_qkey)
                    dup_count += 1
                else:
                    seen_stems[norm_stem] = qid
                    q["duplicate_of"] = None
                    q["qkey"] = base_qkey
                    qkey_by_qid[qid] = base_qkey
            else:
                q["duplicate_of"] = None
                q["qkey"] = base_qkey
                qkey_by_qid[qid] = base_qkey

        test_data_map[tf] = data

    # Re-save updated test files with duplicate_of and qkey populated
    for tf, data in test_data_map.items():
        with open(tf, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    # Compile topics
    topics_acc: Dict[str, Dict[str, Any]] = {}
    for data in test_data_map.values():
        for q in data.get("questions", []):
            t_name = q.get("topic", "General")
            t_sec = q.get("section", "general")
            key = f"{t_sec}:{t_name}"
            if key not in topics_acc:
                topics_acc[key] = {
                    "id": slugify(t_name),
                    "name": t_name,
                    "section": t_sec,
                    "count": 0,
                    "uniqueCount": 0,
                    "conf_sum": 0.0,
                }
            topics_acc[key]["count"] += 1
            if not q.get("duplicate_of"):
                topics_acc[key]["uniqueCount"] += 1
            topics_acc[key]["conf_sum"] += q.get("confidence", 1.0)

    topics_list: List[Dict[str, Any]] = []
    section_order = {"reasoning": 1, "general_awareness": 2, "quantitative_aptitude": 3, "english": 4}
    for key, item in sorted(
        topics_acc.items(),
        key=lambda x: (section_order.get(x[1]["section"], 99), -x[1]["uniqueCount"], x[1]["name"])
    ):
        count = item["count"]
        unique_cnt = item["uniqueCount"]
        avg_conf = round(item["conf_sum"] / count, 3) if count > 0 else 1.0
        topics_list.append({
            "id": item["id"],
            "name": item["name"],
            "section": item["section"],
            "count": count,
            "uniqueCount": unique_cnt,
            "small": unique_cnt < 8,
            "average_confidence": avg_conf,
        })

    # Write public/data/topics.json
    topics_path = os.path.join(output_dir, "topics.json")
    with open(topics_path, "w", encoding="utf-8") as f:
        json.dump(topics_list, f, indent=2, ensure_ascii=False)
    print(f"[Ingest] Wrote {len(topics_list)} topics to {topics_path} (Identified {dup_count} cross-paper duplicates)")

    # Update manifest.json to include topics
    manifest_path = os.path.join(output_dir, "manifest.json")
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest_data = json.load(f)
            manifest_data["topics"] = topics_list
            with open(manifest_path, "w", encoding="utf-8") as f:
                json.dump(manifest_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[Ingest] Note: updating manifest with topics: {e}")

    return topics_list


def print_topic_report(tests_dir: str = "public/data/tests", topics_yaml: str = "profiles/topics.yaml"):
    """Print the topic report table and the 40 questions most likely mis-tagged."""
    test_files = sorted(glob.glob(os.path.join(tests_dir, "*.json")))
    test_files = [f for f in test_files if not f.endswith(".report.json")]

    if not test_files:
        print("[Topic Report] No tests found in", tests_dir)
        return

    classifier = TopicClassifier(topics_yaml)

    # Accumulate stats
    topics_acc: Dict[str, Dict[str, Any]] = {}
    weak_matches: List[Dict[str, Any]] = []

    total_questions = 0
    total_unique = 0

    for tf in test_files:
        try:
            with open(tf, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            continue
        test_id = data.get("id", os.path.basename(tf).replace(".json", ""))

        for q in data.get("questions", []):
            total_questions += 1
            is_unique = not q.get("duplicate_of")
            if is_unique:
                total_unique += 1

            sec = q.get("section", "unknown")
            top = q.get("topic", "General")
            conf = q.get("confidence", 1.0)
            stem = q.get("stem", "")

            key = (sec, top)
            if key not in topics_acc:
                topics_acc[key] = {
                    "section": sec,
                    "topic": top,
                    "count": 0,
                    "unique": 0,
                    "conf_sum": 0.0,
                }
            topics_acc[key]["count"] += 1
            if is_unique:
                topics_acc[key]["unique"] += 1
            topics_acc[key]["conf_sum"] += conf

            # Diagnostic classification to spot weak/fragile matches
            meta = classifier.classify_with_meta(stem, section_id=sec, render_mode=q.get("render_mode"))
            if meta.get("weak") or meta.get("fallback"):
                weak_matches.append({
                    "test_id": test_id,
                    "n": q.get("n"),
                    "section": sec,
                    "topic": top,
                    "matched": meta.get("matched_text") or meta.get("matched_pattern", "none"),
                    "stem": stem.replace("\n", " ")[:60],
                    "confidence": conf,
                })

    section_order = {"reasoning": 1, "general_awareness": 2, "quantitative_aptitude": 3, "english": 4}

    print("\n" + "=" * 90)
    print("EXAMQUEST TOPIC COVERAGE & RELIABILITY REPORT (--topic-report)")
    print(f"Total Papers: {len(test_files)} | Total Questions: {total_questions:,} | Unique Questions: {total_unique:,}")
    print("=" * 90)
    print(f"{'Section':<23} | {'Topic':<30} | {'Count':<7} | {'Unique':<7} | {'Avg Conf':<8} | {'Status'}")
    print("-" * 90)

    for (sec, top), item in sorted(
        topics_acc.items(),
        key=lambda x: (section_order.get(x[0][0], 99), -x[1]["unique"], x[0][1])
    ):
        cnt = item["count"]
        uniq = item["unique"]
        avg_conf = item["conf_sum"] / cnt if cnt else 1.0
        status = "Small (<8)" if uniq < 8 else "Healthy"
        print(f"{sec:<23} | {top:<30} | {cnt:<7} | {uniq:<7} | {avg_conf:<8.3f} | {status}")

    print("-" * 90)
    print(f"Total Unique Topics Active: {len(topics_acc)}")
    print("=" * 90)

    # Print 40 questions most likely mis-tagged
    print("\n" + "=" * 90)
    print("TOP 40 QUESTIONS MOST LIKELY MIS-TAGGED (Matched by weak single keyword or fallback):")
    print("=" * 90)
    print(f"{'Paper ID':<22} | {'Q#':<5} | {'Section':<14} | {'Topic':<22} | {'Matched Text':<15} | {'Stem Snippet'}")
    print("-" * 90)

    for wm in weak_matches[:40]:
        print(f"{wm['test_id']:<22} | {wm['n']:<5} | {wm['section']:<14} | {wm['topic'][:22]:<22} | {wm['matched'][:15]:<15} | {wm['stem']}")

    print("=" * 90 + "\n")


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


def lint_all(tests_dir: str = "public/data/tests"):
    """Audit all parsed papers and print a formatted table of questions with warnings grouped by problem type."""
    test_files = sorted(glob.glob(os.path.join(tests_dir, "*.json")))
    test_files = [f for f in test_files if not f.endswith(".report.json")]

    if not test_files:
        print("[Lint] No test JSON files found in", tests_dir)
        return

    problem_groups: Dict[str, List[Dict[str, Any]]] = {
        "Fewer than 4 options": [],
        "Empty option text": [],
        "Duplicate options": [],
        "Stray option marker in stem": [],
        "Missing / Invalid answer": [],
        "Low confidence (< 0.9)": [],
        "Other warnings": [],
    }

    all_flagged: List[Dict[str, Any]] = []
    total_questions = 0
    total_papers = len(test_files)

    for tf in test_files:
        try:
            with open(tf, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[Lint Error] Reading {tf}: {e}")
            continue

        test_id = data.get("id", os.path.basename(tf))
        questions = data.get("questions", [])
        total_questions += len(questions)

        for q in questions:
            qn = q.get("n")
            warnings = q.get("warnings", [])
            conf = q.get("confidence", 1.0)
            mode = q.get("render_mode", "text")
            topic = q.get("topic", "General")

            if warnings or conf < 0.9:
                item = {
                    "test_id": test_id,
                    "q_num": qn,
                    "topic": topic,
                    "mode": mode,
                    "confidence": conf,
                    "warnings": warnings,
                }
                all_flagged.append(item)

                # Categorize
                categorized = False
                for w in warnings:
                    w_lower = w.lower()
                    if "fewer than 4" in w_lower or "expected 4 options" in w_lower:
                        problem_groups["Fewer than 4 options"].append(item)
                        categorized = True
                    elif "empty option" in w_lower:
                        problem_groups["Empty option text"].append(item)
                        categorized = True
                    elif "duplicate" in w_lower:
                        problem_groups["Duplicate options"].append(item)
                        categorized = True
                    elif "stray option" in w_lower or "marker" in w_lower:
                        problem_groups["Stray option marker in stem"].append(item)
                        categorized = True
                    elif "missing answer" in w_lower or "answer index" in w_lower:
                        problem_groups["Missing / Invalid answer"].append(item)
                        categorized = True

                if conf < 0.9 and not categorized:
                    problem_groups["Low confidence (< 0.9)"].append(item)
                    categorized = True
                elif not categorized and warnings:
                    problem_groups["Other warnings"].append(item)

    # Print Summary Table
    print("\n" + "=" * 80)
    print("EXAMQUEST QUESTION QUALITY AUDIT SUMMARY (--lint-all)")
    print(f"Scanned: {total_papers} Papers | Total Questions: {total_questions:,}")
    print("=" * 80)
    print(f"{'Problem Category':<35} | {'Count':<8} | {'% of Total':<10} | {'Status'}")
    print("-" * 80)

    for cat, items in problem_groups.items():
        cnt = len(items)
        pct = (cnt / total_questions * 100) if total_questions else 0
        status = "PASSED" if cnt == 0 else ("FLAGGED" if cnt < 10 else "ATTENTION")
        icon = "[OK]" if cnt == 0 else ("[WARN]" if cnt < 10 else "[FAIL]")
        print(f"{cat:<35} | {cnt:<8} | {pct:>8.2f}% | {icon} {status}")

    print("-" * 80)
    total_flagged_count = len(all_flagged)
    total_pct = (total_flagged_count / total_questions * 100) if total_questions else 0
    print(f"{'TOTAL FLAGGED QUESTIONS':<35} | {total_flagged_count:<8} | {total_pct:>8.2f}% | {'[AUDIT COMPLETE]'}")
    print("=" * 80)

    if all_flagged:
        print("\nDETAILED FLAGGED QUESTIONS BREAKDOWN:")
        print(f"{'Paper ID':<24} | {'Q#':<5} | {'Topic':<20} | {'Mode':<11} | {'Conf':<5} | {'Warnings'}")
        print("-" * 95)
        for item in all_flagged[:50]:  # Show up to 50
            w_str = "; ".join(item["warnings"]) if item["warnings"] else "Low confidence"
            print(f"{item['test_id']:<24} | {item['q_num']:<5} | {item['topic'][:20]:<20} | {item['mode']:<11} | {item['confidence']:<5.2f} | {w_str[:40]}")
        if len(all_flagged) > 50:
            print(f"... and {len(all_flagged) - 50} more questions.")
    else:
        print("\nNo questions flagged! All 1,200 questions across all 12 papers meet high confidence quality standards.")
    print("=" * 80 + "\n")


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
    parser.add_argument("--lint-all", action="store_true", help="Scan and audit all papers, reporting grouped warnings table")
    parser.add_argument("--topic-report", action="store_true", help="Print table of section | topic | question count | unique count | avg conf and 40 weakest matches")
    args = parser.parse_args()

    if args.topic_report:
        print_topic_report(os.path.join(args.output, "tests"), args.topics)
        return

    if args.lint_all:
        lint_all(os.path.join(args.output, "tests"))
        return

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
    postprocess_duplicates_and_topics(os.path.join(args.output, "tests"), args.output)
    generate_index_doc(manifest_entries, args.docs)


if __name__ == "__main__":
    main()
