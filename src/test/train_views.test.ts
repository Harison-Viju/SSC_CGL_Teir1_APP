/**
 * Test Suite: Train Hub and Learn Mode Flow with Responsive Overflow Audit.
 * Tests:
 * 1. Six-width overflow audit across [360, 450, 768, 917, 1366, 1882] on #/train and #/train/:topicId.
 * 2. Playwright interaction flow:
 *    - Open #/train
 *    - Open a topic card
 *    - Answer 3 questions in Learn mode
 *    - Verify topic card's attempted count increases.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const widths = [360, 450, 768, 917, 1366, 1882];
const height = 800;

test("Train views responsive overflow suite across 6 required breakpoints", async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: "dark",
      });
      const page = await context.newPage();

      // Test 1: #/train
      await page.goto("http://localhost:3000/#/train");
      await page.waitForSelector("text=Topic Practice Hub", { timeout: 10000 });
      await page.waitForTimeout(400);

      const trainScroll = await page.evaluate(() => ({
        winWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));

      assert.ok(
        trainScroll.docScrollWidth <= trainScroll.winWidth + 1,
        `Train view docScrollWidth ${trainScroll.docScrollWidth}px exceeds winWidth ${trainScroll.winWidth}px at ${width}px`
      );

      // Test 2: #/train/blood-relations
      await page.goto("http://localhost:3000/#/train/blood-relations");
      await page.waitForSelector("text=Blood Relations", { timeout: 10000 });
      await page.waitForTimeout(400);

      const topicScroll = await page.evaluate(() => ({
        winWidth: window.innerWidth,
        docScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));

      assert.ok(
        topicScroll.docScrollWidth <= topicScroll.winWidth + 1,
        `Topic detail view docScrollWidth ${topicScroll.docScrollWidth}px exceeds winWidth ${topicScroll.winWidth}px at ${width}px`
      );

      await context.close();
    }
  } finally {
    await browser.close();
  }
});

test("Playwright flow: open #/train, open topic, answer 3 questions in Learn mode, check attempted count changed", async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const page = await context.newPage();

    // 1. Open #/train
    await page.goto("http://localhost:3000/#/train");
    await page.waitForSelector("text=Topic Practice Hub", { timeout: 10000 });
    await page.waitForTimeout(500);

    // Find the Blood Relations card and extract initial attempted count
    const initialText = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("a"));
      const brCard = cards.find((el) => el.textContent?.includes("Blood Relations"));
      return brCard?.textContent || "";
    });

    assert.ok(initialText.includes("Blood Relations"), "Blood Relations topic card not found on #/train");
    const initialMatch = initialText.match(/(\d+)\s*\/\s*\d+\s*attempted/);
    const initialAttempted = initialMatch ? parseInt(initialMatch[1], 10) : 0;

    // 2. Click the Blood Relations topic card
    await page.click("text=Blood Relations");
    await page.waitForSelector("text=Learn Mode", { timeout: 10000 });
    await page.waitForTimeout(300);

    // 3. Click "Start Learn Mode"
    await page.click("text=Start Learn Mode");
    await page.waitForSelector("text=Quizzy:", { timeout: 10000 });
    await page.waitForTimeout(500);

    // 4. Answer 3 questions
    for (let i = 0; i < 3; i++) {
      // Pick first option button
      const optionButtons = page.locator("button[class*='rounded-2xl']").filter({
        hasText: /Option \([a-d]\)|[A-D]\./,
      });

      // Alternatively click option via keyboard "1"
      await page.keyboard.press("1");
      await page.waitForTimeout(400);

      // Check feedback is visible
      const checkOrContinue = page.locator("button:has-text('Continue'), button:has-text('Next Question')");
      if (await checkOrContinue.isVisible()) {
        await checkOrContinue.click();
      } else {
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(400);
    }

    // 5. Exit back to topic or train
    // Click exit button in header
    const exitBtn = page.locator("button[title='Exit Practice']");
    await exitBtn.click();
    await page.waitForSelector("text=Blood Relations", { timeout: 10000 });

    // Navigate to #/train
    await page.goto("http://localhost:3000/#/train");
    await page.waitForSelector("text=Topic Practice Hub", { timeout: 10000 });
    await page.waitForTimeout(600);

    // 6. Check that the topic card's attempted count changed
    const updatedText = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("a"));
      const brCard = cards.find((el) => el.textContent?.includes("Blood Relations"));
      return brCard?.textContent || "";
    });

    const updatedMatch = updatedText.match(/(\d+)\s*\/\s*\d+\s*attempted/);
    const updatedAttempted = updatedMatch ? parseInt(updatedMatch[1], 10) : 0;

    assert.ok(
      updatedAttempted > initialAttempted,
      `Expected updated attempted (${updatedAttempted}) to be greater than initial (${initialAttempted})`
    );
    console.log(`Verified topic attempted count changed from ${initialAttempted} to ${updatedAttempted}`);

    await context.close();
  } finally {
    await browser.close();
  }
});
