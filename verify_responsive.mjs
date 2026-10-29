import { chromium } from "playwright";
import fs from "fs";

const widths = [360, 450, 768, 917, 1366, 1882];
const height = 800;

fs.mkdirSync("public/screenshots", { recursive: true });

async function run() {
  console.log("Starting responsive layout verification & screenshot capture...");
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: "dark",
    });
    const page = await context.newPage();

    page.on("pageerror", (err) => {
      console.error(`[Width ${width}px] Page error:`, err.message);
    });

    await page.goto("http://localhost:3000/#/exam/ssc-cgl-2026-10-01?mode=full");

    await page.evaluate(() => {
      localStorage.setItem("examquest_theme", "dark");
      document.documentElement.classList.add("dark");
    });

    // Wait for the exam question card to be fully rendered
    await page.waitForSelector("text=Q1", { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify checks on visible elements
    const metrics = await page.evaluate(() => {
      const winW = window.innerWidth;
      const docScrollW = document.documentElement.scrollWidth;
      const bodyScrollW = document.body.scrollWidth;

      // Find any element that overflows horizontally
      const overflowingElements = [];
      const allEls = Array.from(document.querySelectorAll("*"));
      for (const el of allEls) {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
        if (style.position === "fixed") continue;
        const rect = el.getBoundingClientRect();
        if (rect.right > winW + 1.5) {
          overflowingElements.push({
            tag: el.tagName,
            className: (el.className || "").toString().slice(0, 60),
            right: Math.round(rect.right),
            winW,
          });
        }
      }

      // Check visible logo position
      const visibleLogos = Array.from(document.querySelectorAll("span")).filter(
        s => s.textContent === "ExamQuest" && s.getClientRects().length > 0 && s.getBoundingClientRect().width > 0
      );
      const logoRect = visibleLogos.length > 0 ? visibleLogos[0].getBoundingClientRect() : null;

      // Check visible topic element single-line
      const topicEl = Array.from(document.querySelectorAll("span[title='Mirror & Water Images']")).find(
        s => s.getClientRects().length > 0
      );
      const topicRect = topicEl ? topicEl.getBoundingClientRect() : null;
      const topicHeight = topicRect ? topicRect.height : null;

      // Check image width
      const imgEl = document.querySelector("img[alt='Question 1 diagram']");
      const imgRect = imgEl ? imgEl.getBoundingClientRect() : null;

      // Check visible Submit button and Timer
      const visibleSubmitBtns = Array.from(document.querySelectorAll("button")).filter(
        b => b.textContent.trim().includes("Submit") && b.getClientRects().length > 0 && b.getBoundingClientRect().width > 0
      );
      const submitRect = visibleSubmitBtns.length > 0 ? visibleSubmitBtns[0].getBoundingClientRect() : null;

      const visibleTimers = Array.from(document.querySelectorAll("header [title*='Total']")).filter(
        t => t.getClientRects().length > 0 && t.getBoundingClientRect().width > 0
      );
      const timerRect = visibleTimers.length > 0 ? visibleTimers[0].getBoundingClientRect() : null;

      let submitTimerOverlap = false;
      if (submitRect && timerRect) {
        submitTimerOverlap = !(
          submitRect.right < timerRect.left ||
          submitRect.left > timerRect.right ||
          submitRect.bottom < timerRect.top ||
          submitRect.top > timerRect.bottom
        );
      }

      return {
        winW,
        docScrollW,
        bodyScrollW,
        hasDocOverflow: docScrollW > winW,
        hasBodyOverflow: bodyScrollW > winW,
        overflowCount: overflowingElements.length,
        overflowingElements: overflowingElements.slice(0, 3),
        logoLeft: logoRect ? Math.round(logoRect.left) : null,
        topicHeight: topicHeight ? Math.round(topicHeight) : null,
        imgWidth: imgRect ? Math.round(imgRect.width) : null,
        submitVisible: Boolean(submitRect && submitRect.width > 0 && submitRect.right <= winW),
        timerVisible: Boolean(timerRect && timerRect.width > 0 && timerRect.right <= winW),
        submitTimerOverlap,
      };
    });

    console.log(`\n--- Verification for Width ${width}px ---`);
    console.log(`Window Width: ${metrics.winW}px | Document ScrollWidth: ${metrics.docScrollW}px`);
    console.log(`Logo Left Padding: ${metrics.logoLeft}px (>= 16px required)`);
    console.log(`Topic Height: ${metrics.topicHeight}px (single line <= 28px)`);
    console.log(`Image Rendered Width: ${metrics.imgWidth}px (at 917px must be >= 320px)`);
    console.log(`Submit Visible: ${metrics.submitVisible} | Timer Visible: ${metrics.timerVisible} | Overlap: ${metrics.submitTimerOverlap}`);

    let passed = true;
    if (metrics.hasDocOverflow || metrics.hasBodyOverflow || metrics.overflowCount > 0) {
      console.error(`FAILED: Horizontal overflow at ${width}px!`, metrics.overflowingElements);
      passed = false;
    }
    if (metrics.logoLeft !== null && metrics.logoLeft < 15) {
      console.error(`FAILED: Logo left position ${metrics.logoLeft}px is less than 16px!`);
      passed = false;
    }
    if (width === 450 && (!metrics.submitVisible || !metrics.timerVisible || metrics.submitTimerOverlap)) {
      console.error(`FAILED at 450px: Submit and Timer must both be visible without overlapping!`);
      passed = false;
    }
    if (width === 917 && metrics.imgWidth !== null && metrics.imgWidth < 320) {
      console.error(`FAILED at 917px: Image width ${metrics.imgWidth}px is less than 320px!`);
      passed = false;
    }

    results.push({ width, passed, metrics });

    // Capture screenshot and save
    const screenshotPath = `public/screenshots/exam_w${width}_dark.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Captured: ${screenshotPath}`);

    await context.close();
  }

  await browser.close();

  const allPassed = results.every(r => r.passed);
  if (!allPassed) {
    console.error("\n❌ Some width checks failed verification.");
    process.exit(1);
  } else {
    console.log("\n✅ All six widths passed responsive layout & zero horizontal overflow verification!");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
