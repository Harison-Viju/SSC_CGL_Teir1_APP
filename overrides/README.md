# ExamQuest Question Overrides

This directory contains manual overrides for parsed questions.
Files should be named `<test_id>.json` (for example, `ssc-cgl-2026-10-01.json`).

### Override Schema
Each key is the 1-based question number (e.g., `"14"`). Any field specified in the override object will overwrite the automatically parsed field:

```json
{
  "14": {
    "answer": 3,
    "render_mode": "image_stem",
    "note": "Correction verified from official answer key"
  },
  "52": {
    "render_mode": "image_stem"
  }
}
```

### Auto-generation
Run:
```bash
python -m ingest --suggest-overrides
```
to automatically produce an edit skeleton for any questions flagged with low confidence or validation warnings.
