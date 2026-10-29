"""High-resolution page region cropper and WebP optimizer for ExamQuest."""

import os
from typing import Any, Dict, List, Optional, Tuple
import pypdfium2 as pdfium
from PIL import Image, ImageChops


class QuestionCropper:
    """Renders PDF page regions at high resolution, trims whitespace, and saves optimized WebP images."""

    def __init__(self, pdf_path: str, scale: float = 2.5, quality: int = 85):
        self.pdf_path = pdf_path
        self.scale = scale
        self.quality = quality
        self.pdf = pdfium.PdfDocument(pdf_path)
        self.page_cache: Dict[int, Image.Image] = {}

    def get_rendered_page(self, page_num: int) -> Image.Image:
        """Get or render a full page image at target scale (1-based page_num)."""
        if page_num not in self.page_cache:
            page_idx = page_num - 1
            if page_idx < 0 or page_idx >= len(self.pdf):
                raise ValueError(f"Page {page_num} out of bounds (1..{len(self.pdf)})")
            page = self.pdf[page_idx]
            bitmap = page.render(scale=self.scale)
            self.page_cache[page_num] = bitmap.to_pil()
        return self.page_cache[page_num]

    @staticmethod
    def trim_whitespace(img: Image.Image, padding: int = 12) -> Image.Image:
        """Trim surrounding uniform white background, leaving a clean margin."""
        bg = Image.new(img.mode, img.size, (255, 255, 255))
        diff = ImageChops.difference(img, bg)
        bbox = diff.getbbox()
        if not bbox:
            return img
        
        # Add padding
        left = max(0, bbox[0] - padding)
        top = max(0, bbox[1] - padding)
        right = min(img.width, bbox[2] + padding)
        bottom = min(img.height, bbox[3] + padding)
        return img.crop((left, top, right, bottom))

    def crop_bbox(
        self,
        page_num: int,
        top_pt: float,
        bottom_pt: float,
        x0_pt: float = 30.0,
        x1_pt: float = 565.0,
    ) -> Image.Image:
        """Crop a specific rectangular area on a single page in point coordinates."""
        page_img = self.get_rendered_page(page_num)
        
        # Convert points to pixel coordinates
        left_px = max(0, int(x0_pt * self.scale))
        right_px = min(page_img.width, int(x1_pt * self.scale))
        top_px = max(0, int(top_pt * self.scale))
        bottom_px = min(page_img.height, int(bottom_pt * self.scale))

        if bottom_px <= top_px:
            bottom_px = top_px + int(20 * self.scale)

        return page_img.crop((left_px, top_px, right_px, bottom_px))

    def crop_question(
        self,
        q: Dict[str, Any],
        output_dir: str,
        test_id: str,
    ) -> Dict[str, Optional[str]]:
        """Generate cropped WebP image for a question based on its render_mode.
        
        Returns dict with keys: 'stem_image', 'full_image'.
        """
        mode = q.get("render_mode", "text")
        if mode == "text":
            return {"stem_image": None, "full_image": None}

        os.makedirs(output_dir, exist_ok=True)
        q_num = q["n"]
        bbox = q.get("_bbox", {})
        page = bbox.get("page", 1)
        stem_top = bbox.get("stem_top", 100.0)
        stem_bottom = bbox.get("stem_bottom", 200.0)
        opts_bottom = bbox.get("opts_bottom", stem_bottom)
        ans_top = bbox.get("ans_top")
        ans_page = bbox.get("ans_page", page)

        stem_image_path = None
        full_image_path = None

        if mode == "image_full":
            filename = f"q{q_num:03d}_full.webp"
            file_abs_path = os.path.join(output_dir, filename)
            
            # For image_full: start at stem_top - 4, end right above ans_top (if on same page)
            top_pt = max(88.0, stem_top - 4.0)
            if ans_page == page and ans_top and ans_top > top_pt:
                bottom_pt = ans_top - 3.0
            else:
                bottom_pt = max(stem_bottom, opts_bottom) + 4.0

            cropped = self.crop_bbox(page, top_pt, bottom_pt)
            trimmed = self.trim_whitespace(cropped)
            trimmed.convert("RGB").save(file_abs_path, "WEBP", quality=self.quality, method=6)
            full_image_path = f"img/{test_id}/{filename}"

        elif mode == "image_stem":
            filename = f"q{q_num:03d}_stem.webp"
            file_abs_path = os.path.join(output_dir, filename)

            top_pt = max(88.0, stem_top - 4.0)
            bottom_pt = stem_bottom + 4.0

            cropped = self.crop_bbox(page, top_pt, bottom_pt)
            trimmed = self.trim_whitespace(cropped)
            trimmed.convert("RGB").save(file_abs_path, "WEBP", quality=self.quality, method=6)
            stem_image_path = f"img/{test_id}/{filename}"

        return {
            "stem_image": stem_image_path,
            "full_image": full_image_path,
        }
