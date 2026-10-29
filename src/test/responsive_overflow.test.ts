/**
 * Test Suite: Exam View Responsive Overflow Audit.
 * Tests widths: 360, 450, 768, 917, 1366, 1882 at height 800 (Dark Theme).
 * Asserts zero horizontal element overflow, logo visibility, and non-overlapping header controls.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const widths = [360, 450, 768, 917, 1366, 1882];
const height = 800;

test("Exam view responsive overflow suite across 6 required breakpoints", async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: "dark",
      });
      const page = await context.newPage();

      await page.goto("http://localhost:3000/#/exam/ssc-cgl-2026-10-01?mode=full");

      await page.evaluate(() => {
        localStorage.setItem("examquest_theme", "dark");
        document.documentElement.classList.add("dark");
      });

      await page.waitForSelector("text=Q1", { timeout: 10000 });
      await page.waitForTimeout(500);

      // 1. Assert document and body do not exceed viewport width
      const scrollDimensions = await page.evaluate(() => ({
        winWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));

      assert.ok(
        scrollDimensions.docScrollWidth <= scrollDimensions.winWidth,
        `Document scrollWidth ${scrollDimensions.docScrollWidth}px exceeds window width ${scrollDimensions.winWidth}px at ${width}px`
      );
      assert.ok(
        scrollDimensions.bodyScrollWidth <= scrollDimensions.winWidth,
        `Body scrollWidth ${scrollDimensions.bodyScrollWidth}px exceeds window width ${scrollDimensions.winWidth}px at ${width}px`
      );

      // 2. Assert no visible non-fixed element exceeds the viewport width
      const overflowingElements = await page.evaluate((winW) => {
        const found = [];
        const allElements = document.querySelectorAll("*");
        for (const el of allElements) {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
          if (style.position === "fixed") continue;
          const rect = el.getBoundingClientRect();
          if (rect.right > winW + 1.5) {
            found.push({
              tag: el.tagName,
              className: (el.className || "").toString().slice(0, 50),
              right: Math.round(rect.right),
              winW,
            });
          }
        }
        return found;
      }, scrollDimensions.winWidth);

      assert.equal(
        overflowingElements.length,
        0,
        `Found overflowing elements at ${width}px: ${JSON.stringify(overflowingElements)}`
      );

      // 3. Assert visible Logo has at least 16px left padding
      const logoLeft = await page.evaluate(() => {
        const visibleLogos = Array.from(document.querySelectorAll("span")).filter(
          s => s.textContent === "ExamQuest" && s.getClientRects().length > 0 && s.getBoundingClientRect().width > 0
        );
        return visibleLogos.length > 0 ? Math.round(visibleLogos[0].getBoundingClientRect().left) : 0;
      });
      assert.ok(
        logoLeft >= 15,
        `Visible Logo left padding ${logoLeft}px is less than 16px at ${width}px`
      );

      // 4. At 450px: Submit button and Timer must both be visible without overlapping
      if (width === 450) {
        const controls = await page.evaluate(() => {
          const visibleSubmitBtns = Array.from(document.querySelectorAll("button")).filter(
            b => b.textContent?.includes("Submit") && b.getClientRects().length > 0 && b.getBoundingClientRect().width > 0
          );
          const submitBtn = visibleSubmitBtns[0];
          const visibleTimers = Array.from(document.querySelectorAll("header [title*='Total']")).filter(
            t => t.getClientRects().length > 0 && t.getBoundingClientRect().width > 0
          );
          const timer = visibleTimers[0];

          if (!submitBtn || !timer) return { valid: false, submitVisible: false, timerVisible: false, overlap: true };
          const sRect = submitBtn.getBoundingClientRect();
          const tRect = timer.getBoundingClientRect();
          const overlap = !(
            sRect.right < tRect.left ||
            sRect.left > tRect.right ||
            sRect.bottom < tRect.top ||
            sRect.top > tRect.bottom
          );
          return {
            valid: true,
            submitVisible: sRect.width > 0 && sRect.right <= window.innerWidth,
            timerVisible: tRect.width > 0 && tRect.right <= window.innerWidth,
            overlap,
          };
        });

        assert.equal(controls.valid, true, "Submit button or Timer missing at 450px");
        assert.equal(controls.submitVisible, true, "Submit button not visible at 450px");
        assert.equal(controls.timerVisible, true, "Total timer not visible at 450px");
        assert.equal(controls.overlap, false, "Submit button and timer overlap at 450px");
      }

      // 5. At 917px: image must be readable and at least 320px wide
      if (width === 917) {
        const imgWidth = await page.evaluate(() => {
          const img = document.querySelector("img[alt='Question 1 diagram']");
          return img ? img.getBoundingClientRect().width : 0;
        });
        assert.ok(
          imgWidth >= 320,
          `Image rendered width at 917px is ${imgWidth}px (expected >= 320px)`
        );
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }
});
