"""Core parsing logic converting PDF documents into structured ExamQuest question sets."""

import os
import re
import hashlib
from typing import Any, Dict, List, Optional, Tuple
import pdfplumber

from .layout import (
    is_ad_page,
    is_noise_text,
    group_words_into_lines,
    extract_metadata,
)
from .sections import get_section_for_question
from .topics import TopicClassifier
from .figures import determine_render_mode, detect_table_in_stem

OPT_START_RE = re.compile(r"^(?:\(([a-eA-E])\)|([a-eA-E])[.)])\s*(.*)")


LABEL_NAMES = (
    "Statement", "Statements", "Conclusion", "Conclusions",
    "Inference", "Inferences", "Decision", "Decisions",
    "Assumption", "Assumptions", "Course of Action",
    "Directions", "Case", "Criteria", "Special Condition",
    "Master Address", "Candidate Addresses"
)
LABEL_NAMES_SORTED = sorted(LABEL_NAMES, key=len, reverse=True)
LABEL_NAMES_REGEX = "|".join(re.escape(x) for x in LABEL_NAMES_SORTED) + r"|Matrix-?[IVX]+"


def compute_qkey(stem: str, options: Optional[List[str]] = None) -> str:
    """Compute deterministic normalized text hash for question tracking."""
    norm_stem = re.sub(r"\s+", " ", stem or "").strip().lower()
    norm_opts = " ".join(re.sub(r"\s+", " ", o or "").strip().lower() for o in (options or []))
    content = f"{norm_stem}|{norm_opts}" if norm_opts else norm_stem
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

IGNORE_PREV_WORDS = {"to", "and", "or", "from", "between", "labeled", "labelled"}
PREV_CONNECTOR_ENDINGS = ("and", "or", "to", "from", "between", "with", "of", ",", ";")


def is_marker_start(t: str) -> bool:
    """Check if a line begins with a list marker or semantic section label."""
    t = t.strip()
    # List markers: Roman numerals, numeric (1., 2.), lowercase (a), (b)
    if re.match(r"^(?:[IVXLCDM]{1,6}\.|[1-9]\d?\.\s+|\([a-z]\)\s+)", t):
        return True
    m = re.match(rf"^({LABEL_NAMES_REGEX})\s*(:?)(?:\s+(.*)|$)", t, re.IGNORECASE)
    if m:
        name = m.group(1).strip()
        has_colon = bool(m.group(2))
        rest = m.group(3).strip() if m.group(3) else ""
        if has_colon or not rest or name.lower().startswith("matrix"):
            return True
    return False


def parse_stem_lines_to_blocks(stem_lines: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]]]:
    """Parse question stem lines preserving structure, line-breaks, and semantic blocks.
    
    A line is considered a wrapped continuation only if:
    (a) The previous line reached near the right margin (>= 85% of max width)
    (b) The vertical gap is normal line leading (<= 21pt on same page)
    (c) The line does NOT start with a marker or label.
    
    Returns:
        (stem_str_with_newlines, blocks_list)
    """
    if not stem_lines:
        return "", []

    cleaned_lines = []
    for idx, l in enumerate(stem_lines):
        txt = l["text"]
        if idx == 0:
            txt = re.sub(r"^Q\d{1,3}\s*[.)]\s*", "", txt).strip()
        cleaned_lines.append({**l, "text": txt})

    cleaned_lines = [l for l in cleaned_lines if l["text"].strip()]
    if not cleaned_lines:
        return "", []

    widths = [l["x1"] - l["x0"] for l in cleaned_lines]
    max_w = max(max(widths), 520.0)
    right_margin_thresh = 0.85 * max_w

    units = []
    curr_unit = [cleaned_lines[0]]

    for i in range(1, len(cleaned_lines)):
        prev = cleaned_lines[i - 1]
        curr = cleaned_lines[i]

        prev_w = prev["x1"] - prev["x0"]
        reached_right = (prev_w >= right_margin_thresh) or (prev["x1"] >= 530.0)

        same_page = (curr.get("page") == prev.get("page"))
        vert_gap = (curr["top"] - prev["top"]) if same_page else 15.0
        normal_gap = vert_gap <= 21.0

        prev_text = prev["text"].strip()
        ends_with_connector = prev_text.lower().endswith(PREV_CONNECTOR_ENDINGS)

        has_marker = is_marker_start(curr["text"])

        # Continuation rule
        if ends_with_connector and normal_gap:
            is_cont = True
        else:
            is_cont = reached_right and normal_gap and (not has_marker)

        if is_cont:
            curr_unit.append(curr)
        else:
            units.append(curr_unit)
            curr_unit = [curr]
    if curr_unit:
        units.append(curr_unit)

    merged_texts = []
    for unit in units:
        text = ""
        for l in unit:
            t = l["text"].strip()
            if not text:
                text = t
            elif text.endswith("-"):
                text = text[:-1] + "-" + t
            else:
                text += " " + t
        # Fix hyphenation like 'long- term' -> 'long-term'
        text = re.sub(r"(\b[a-zA-Z]+)-\s+([a-zA-Z]+\b)", r"\1-\2", text)
        merged_texts.append(text)

    # Split lines before inline markers or labels
    split_lines = []
    split_pattern = re.compile(
        rf"(?<=\S)\s+("
        rf"(?:{LABEL_NAMES_REGEX})\s*:|"
        r"[IVXLCDM]{1,6}\.\s+(?=[A-Z0-9\"'])|"
        r"[1-9]\d?\.\s+(?=[A-Z0-9\"'])|"
        r"\([a-z]\)\s+(?=[A-Z0-9\"'])"
        r")",
        re.IGNORECASE,
    )

    for mt in merged_texts:
        pos = 0
        chunks = []
        for m in split_pattern.finditer(mt):
            preceding = mt[: m.start()].strip()
            last_word = preceding.split()[-1].lower() if preceding.split() else ""
            if last_word in IGNORE_PREV_WORDS:
                continue
            chunks.append(mt[pos : m.start()].strip())
            pos = m.start()
        chunks.append(mt[pos:].strip())

        for ch in chunks:
            if not ch:
                continue
            # If chunk starts with a label followed by text: e.g. 'Statement: The government...'
            m_lbl = re.match(rf"^({LABEL_NAMES_REGEX})\s*(:?)\s*(.*)", ch, re.IGNORECASE)
            if m_lbl and m_lbl.group(3).strip() and (m_lbl.group(2) or m_lbl.group(1).lower().startswith("matrix")):
                lbl_name = m_lbl.group(1).strip()
                rest = m_lbl.group(3).strip()
                split_lines.append(lbl_name + (":" if m_lbl.group(2) else ""))
                split_lines.append(rest)
            else:
                split_lines.append(ch)

    # Convert to structured blocks
    blocks = []
    for sl in split_lines:
        m_list = re.match(r"^(?:([IVXLCDM]{1,6})\.|([1-9]\d?)\.|\(([a-z])\))\s+(.*)", sl)
        m_label = re.match(rf"^({LABEL_NAMES_REGEX})\s*:?$", sl, re.IGNORECASE)
        if m_list:
            marker = m_list.group(1) or m_list.group(2) or m_list.group(3)
            if m_list.group(3):
                marker = f"({marker})"
            else:
                marker = f"{marker}."
            blocks.append({
                "type": "list_item",
                "marker": marker,
                "text": m_list.group(4).strip(),
            })
        elif m_label:
            blocks.append({
                "type": "label",
                "text": m_label.group(1).strip(),
            })
        else:
            blocks.append({
                "type": "paragraph",
                "text": sl,
            })

    # Build clean stem string with \n
    stem_lines_out = []
    for b in blocks:
        if b["type"] == "label":
            stem_lines_out.append(b["text"] + ":")
        elif b["type"] == "list_item":
            stem_lines_out.append(f"{b.get('marker', '')} {b['text']}".strip())
        else:
            stem_lines_out.append(b["text"])

    return "\n".join(stem_lines_out), blocks


class ExamParser:
    """Extracts questions, options, answers, passages, and figure references from exam PDFs."""

    def __init__(self, profile: Dict[str, Any], topics_path: Optional[str] = None):
        self.profile = profile
        self.classifier = TopicClassifier(topics_path)
        self.noise_patterns = profile.get("noise_patterns", [])
        self.sections = profile.get("sections", [])

    def compute_sha256(self, filepath: str) -> str:
        """Compute SHA-256 hash of a file."""
        hasher = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    def parse_pdf(self, pdf_path: str, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Parse an exam PDF file into full ExamQuest test JSON structure."""
        file_sha256 = self.compute_sha256(pdf_path)

        with pdfplumber.open(pdf_path) as pdf:
            # 1. Identify content vs ad pages
            content_page_indices: List[int] = []
            page_images_map: Dict[int, List[Dict[str, Any]]] = {}
            page_tables_map: Dict[int, List[Any]] = {}

            for idx, p in enumerate(pdf.pages):
                if is_ad_page(p):
                    continue
                content_page_indices.append(idx)
                try:
                    page_tables_map[idx + 1] = p.find_tables()
                except Exception:
                    page_tables_map[idx + 1] = []
                # Store non-header, non-watermark images
                clean_imgs = []
                page_area = float(p.width) * float(p.height)
                for im in p.images:
                    top = float(im.get("top", 0))
                    h = float(im.get("height", 0))
                    w = float(im.get("width", 0))
                    area = w * h
                    # Ignore header logos (<88pt) and full-page watermarks (>25% area)
                    if top < 88.0:
                        continue
                    if area > (page_area * 0.25):
                        continue
                    clean_imgs.append(im)
                page_images_map[idx + 1] = clean_imgs

            # 2. Extract lines from content pages
            all_lines: List[Dict[str, Any]] = []
            first_page_lines: List[Dict[str, Any]] = []

            for page_idx in content_page_indices:
                p = pdf.pages[page_idx]
                page_num = page_idx + 1
                words = p.extract_words(extra_attrs=["fontname", "size"])
                # Ignore words strictly inside the publisher header (<88 pt)
                words = [w for w in words if w["top"] >= 88.0]
                lines = group_words_into_lines(words)

                if page_idx == content_page_indices[0]:
                    first_page_lines = lines

                for l in lines:
                    # Ignore noise patterns
                    if is_noise_text(l["text"], self.noise_patterns):
                        continue
                    # Skip the title line on page 1 for question stream
                    if page_num == 1 and l["top"] < 115.0 and re.search(r"Paper|Exam|SSC", l["text"]):
                        continue
                    l["page"] = page_num
                    all_lines.append(l)

            # 3. Extract metadata
            meta = extract_metadata(first_page_lines, self.profile)
            test_id = f"ssc-cgl-{meta['date']}"
            if meta.get("shift"):
                test_id += f"-s{meta['shift']}"

            # 4. Identify Passages
            # Look for lines with "Directions (77-81): Read the passage..."
            passages: List[Dict[str, Any]] = []
            passage_pattern = re.compile(r"Directions\s*\((\d+)\s*[-–]\s*(\d+)\)\s*:\s*(.*)", re.IGNORECASE)

            # We will scan lines for passages
            i = 0
            while i < len(all_lines):
                line = all_lines[i]
                pm = passage_pattern.search(line["text"])
                if pm:
                    p_start = int(pm.group(1))
                    p_end = int(pm.group(2))
                    p_id = f"p{p_start}-{p_end}"
                    passage_text_parts = [pm.group(3).strip()]
                    
                    # Gather subsequent lines until next question
                    j = i + 1
                    while j < len(all_lines):
                        if re.match(r"^Q\d{1,3}\s*[.)]", all_lines[j]["text"]):
                            break
                        passage_text_parts.append(all_lines[j]["text"])
                        j += 1
                    
                    full_p_text = " ".join(t for t in passage_text_parts if t)
                    passages.append({
                        "id": p_id,
                        "range": [p_start, p_end],
                        "text": full_p_text,
                    })
                    # Remove the passage lines from the question stream
                    del all_lines[i:j]
                    continue
                i += 1

            # 5. Segment Questions
            q_starts: List[Tuple[int, int]] = []
            for idx, l in enumerate(all_lines):
                m = re.match(r"^Q(\d{1,3})\s*[.)]", l["text"])
                if m:
                    q_starts.append((int(m.group(1)), idx))

            questions: List[Dict[str, Any]] = []
            letter_to_index = {"a": 0, "b": 1, "c": 2, "d": 3, "e": 4}
            last_ans_idx = -1

            for idx, (q_num, start_idx) in enumerate(q_starts):
                end_idx = q_starts[idx + 1][1] if (idx + 1 < len(q_starts)) else len(all_lines)
                
                # Check for floating preamble lines between last question's answer and this Q start
                preamble_lines = []
                if last_ans_idx >= 0 and last_ans_idx + 1 < start_idx:
                    preamble_lines = all_lines[last_ans_idx + 1 : start_idx]
                elif last_ans_idx == -1 and start_idx > 0:
                    preamble_lines = all_lines[0 : start_idx]

                q_lines = all_lines[start_idx:end_idx]

                # Locate Answer line
                ans_letter: Optional[str] = None
                ans_line_offset: Optional[int] = None
                for line_i, line in enumerate(q_lines):
                    ans_m = re.search(r"Ans\.?\s*\(?([a-eA-E])\)?", line["text"])
                    if ans_m:
                        ans_letter = ans_m.group(1).lower()
                        ans_line_offset = line_i
                        last_ans_idx = start_idx + line_i
                        break

                # Extract stem and options
                stem_lines: List[Dict[str, Any]] = list(preamble_lines)
                options: List[str] = []
                option_boxes: List[Dict[str, Any]] = []

                for line_i, line in enumerate(q_lines):
                    if line_i == ans_line_offset:
                        continue
                    text = line["text"].strip()
                    opt_m = OPT_START_RE.match(text)
                    if opt_m:
                        let = (opt_m.group(1) or opt_m.group(2)).lower()
                        opt_body = opt_m.group(3).strip()
                        # If no options started yet, accept as option A
                        if not options:
                            if let == "a":
                                options.append(opt_body)
                                option_boxes.append(line)
                            else:
                                stem_lines.append(line)
                        else:
                            options.append(opt_body)
                            option_boxes.append(line)
                    elif not options:
                        stem_lines.append(line)
                    else:
                        # Append continuation line to current option
                        options[-1] = (options[-1] + " " + text).strip()

                # Backward recovery pass: if fewer than 4 options were found, check trailing stem_lines
                if len(options) < 4 and stem_lines:
                    recovered_from_stem: List[Tuple[Dict[str, Any], str]] = []
                    k = len(stem_lines) - 1
                    while k >= 0 and (len(options) + len(recovered_from_stem)) < 4:
                        s_line = stem_lines[k]
                        s_m = OPT_START_RE.match(s_line["text"].strip())
                        if s_m:
                            recovered_from_stem.append((s_line, s_m.group(3).strip()))
                            k -= 1
                        else:
                            break
                    if recovered_from_stem:
                        stem_lines = stem_lines[: k + 1]
                        recovered_from_stem.reverse()
                        for r_box, r_txt in recovered_from_stem:
                            options.insert(0, r_txt)
                            option_boxes.insert(0, r_box)

                clean_stem, blocks = parse_stem_lines_to_blocks(stem_lines)

                # Determine bounding box
                combined_lines = preamble_lines + q_lines
                min_page = min(l["page"] for l in combined_lines)
                max_page = max(l["page"] for l in combined_lines)

                stem_top = min(l["top"] for l in stem_lines) if stem_lines else min(l["top"] for l in combined_lines)
                stem_bottom = max(l["bottom"] for l in stem_lines) if stem_lines else stem_top + 20.0

                first_opt_top = min(l["top"] for l in option_boxes) if option_boxes else None
                opts_bottom = max(l["bottom"] for l in option_boxes) if option_boxes else stem_bottom

                ans_top = None
                ans_page = None
                if ans_line_offset is not None:
                    ans_line = q_lines[ans_line_offset]
                    ans_top = ans_line["top"]
                    ans_page = ans_line["page"]

                # Table detection: pdfplumber find_tables + geometric short lines + column heuristics
                is_table_detected, reconstructed_table = detect_table_in_stem(
                    stem_lines=stem_lines,
                    stem_text=clean_stem,
                    page_tables=page_tables_map.get(min_page, []),
                    stem_top=stem_top,
                    stem_bottom=stem_bottom,
                )

                # Check if images exist on this page in the question region
                page_imgs = page_images_map.get(min_page, [])
                has_image_in_stem = False
                has_image_in_opts = False

                for im in page_imgs:
                    itop = im.get("top", 0)
                    ibot = im.get("bottom", 0)
                    # Does it overlap stem?
                    if (stem_top - 5 <= itop <= (first_opt_top or stem_bottom) + 5) or (stem_top <= ibot <= (first_opt_top or stem_bottom) + 5):
                        has_image_in_stem = True
                        stem_bottom = max(stem_bottom, ibot)
                    # Does it overlap options?
                    if first_opt_top and (first_opt_top - 5 <= itop <= (ans_top or opts_bottom) + 5):
                        has_image_in_opts = True
                        opts_bottom = max(opts_bottom, ibot)

                # Identify matching passage
                attached_passage_id = None
                for p in passages:
                    if p["range"][0] <= q_num <= p["range"][1]:
                        attached_passage_id = p["id"]
                        break

                # Render mode determination
                render_mode, mode_warnings = determine_render_mode(
                    clean_stem,
                    options,
                    has_image_in_stem=has_image_in_stem,
                    has_image_in_options=has_image_in_opts,
                    stem_lines=stem_lines,
                    has_preamble=bool(preamble_lines),
                    is_table=is_table_detected,
                )

                # Assign section & topic
                sec = get_section_for_question(q_num, self.sections)
                topic = self.classifier.classify(clean_stem, sec["id"], render_mode=render_mode)

                # Answer index
                answer_idx = letter_to_index.get(ans_letter) if ans_letter else None

                # Warnings & Strict Validation Per Question
                q_warnings = list(mode_warnings)
                is_valid = True

                # 1. Exactly 4 options
                if len(options) != 4:
                    q_warnings.append(f"Expected 4 options, found {len(options)} for Q{q_num}")
                    is_valid = False

                # 2. No empty options
                if any(len(str(opt).strip()) == 0 for opt in options):
                    q_warnings.append(f"Empty option text found for Q{q_num}")
                    is_valid = False

                # 3. No duplicate options
                non_empty_opts = [str(opt).strip().lower() for opt in options if str(opt).strip()]
                if len(set(non_empty_opts)) < len(non_empty_opts):
                    q_warnings.append(f"Duplicate options detected for Q{q_num}")
                    is_valid = False

                # 4. No stray option marker lines left in the stem
                for sl in stem_lines:
                    if OPT_START_RE.match(sl["text"].strip()):
                        q_warnings.append(f"Stray option marker '{sl['text'].strip()[:10]}' left in stem for Q{q_num}")
                        is_valid = False
                        break

                # 5. Answer is one of the options
                if answer_idx is None:
                    q_warnings.append(f"Missing answer for Q{q_num}")
                    is_valid = False
                elif answer_idx < 0 or answer_idx >= len(options):
                    q_warnings.append(f"Answer index {answer_idx} out of range (options={len(options)}) for Q{q_num}")
                    is_valid = False

                confidence = 1.0
                if render_mode != "text":
                    confidence = 0.95
                if not is_valid or q_warnings:
                    confidence = min(0.85, 1.0 - 0.1 * len(q_warnings))

                # Low-confidence default: if confidence < 0.9, default to cropped image
                if confidence < 0.9 and render_mode == "text":
                    if len(options) == 4 and not any(len(str(opt).strip()) == 0 for opt in options):
                        render_mode = "image_stem"
                    else:
                        render_mode = "image_full"

                # Question structure
                q_obj = {
                    "n": q_num,
                    "section": sec["id"],
                    "topic": topic,
                    "render_mode": render_mode,
                    "stem": clean_stem,
                    "blocks": blocks,
                    "table": reconstructed_table,
                    "stem_image": None,
                    "full_image": None,
                    "orig_image": None,
                    "options": options if render_mode != "image_full" else ["A", "B", "C", "D"],
                    "raw_options": options,
                    "answer": answer_idx,
                    "passage_id": attached_passage_id,
                    "confidence": round(max(confidence, 0.1), 2),
                    "warnings": q_warnings,
                    "duplicate_of": None,
                    "qkey": compute_qkey(clean_stem, options),
                    "_bbox": {
                        "page": min_page,
                        "min_page": min_page,
                        "max_page": max_page,
                        "stem_top": stem_top,
                        "stem_bottom": stem_bottom,
                        "first_opt_top": first_opt_top,
                        "opts_bottom": opts_bottom,
                        "ans_top": ans_top,
                        "ans_page": ans_page,
                    },
                }

                # Apply overrides if available
                if overrides and str(q_num) in overrides:
                    q_patch = overrides[str(q_num)]
                    for k, v in q_patch.items():
                        if k != "n":
                            q_obj[k] = v

                questions.append(q_obj)

            # Build result test object
            test_obj = {
                "schema_version": 1,
                "id": test_id,
                "title": meta["title"],
                "exam": meta["exam"],
                "date": meta["date"],
                "shift": meta.get("shift"),
                "language": "en",
                "source_file": pdf_path,
                "source_sha256": file_sha256,
                "marking": self.profile.get("marking", {"correct": 2.0, "wrong": -0.5, "unanswered": 0.0}),
                "duration_minutes": self.profile.get("duration_minutes", 60),
                "sections": self.sections,
                "passages": passages,
                "questions": questions,
            }

            return test_obj
