import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  page.on("console", (msg) => console.log("[BROWSER CONSOLE]", msg.text()));
  page.on("pageerror", (err) => console.log("[BROWSER ERROR]", err.message));

  console.log("Navigating to exam for ssc-cgl-2026-10-05...");
  await page.goto("http://localhost:3000/#/exam/ssc-cgl-2026-10-05?mode=full");
  await page.waitForSelector("text=Q1", { timeout: 10000 });

  // Look for Quant tab in header
  const quantTab = await page.$("header button:has-text('Quant')");
  console.log("Quant tab found:", Boolean(quantTab));
  if (quantTab) {
    console.log("Clicking Quant tab...");
    await quantTab.click();
    await page.waitForTimeout(500);
  }

  // Check palette buttons now
  const paletteBtnsQuant = await page.$$eval("aside button", (btns) =>
    btns.map((b) => b.textContent?.trim()).filter(Boolean)
  );
  console.log("Palette buttons in Quant:", paletteBtnsQuant);

  // Find button with text "54"
  const q54Btn = await page.$("aside button:has-text('54')");
  console.log("Q54 button found in palette:", Boolean(q54Btn));

  if (q54Btn) {
    console.log("Clicking Q54 button...");
    await q54Btn.click();
    await page.waitForTimeout(500);
  }

  // Check active question header
  const qHeader = await page.$eval("section h2, section [class*='font-black']", (el) => el.textContent?.trim());
  console.log("Active question header:", qHeader);

  // Check section tabs and palette header
  const paletteHeader = await page.$eval("aside [class*='truncate']", (el) => el.textContent?.trim());
  console.log("Palette section header:", paletteHeader);

  // Check Option buttons
  const optionButtonsText = await page.$$eval("section button", (btns) =>
    btns.map((b) => b.textContent?.trim()).filter(Boolean)
  );
  console.log("All section buttons text:", optionButtonsText);

  // Take screenshot before click
  await page.screenshot({ path: "test_screenshots/q54_before_click.png" });

  // Try clicking Option A
  const optA = await page.$("section button:has-text('A')");
  if (optA) {
    const isVisible = await optA.isVisible();
    const box = await optA.boundingBox();
    console.log("Option A visible:", isVisible, "Box:", box);

    console.log("Clicking Option A...");
    await optA.click();
    await page.waitForTimeout(500);

    // Check if Option A is selected (class has sky-600 or ring-sky)
    const optAClass = await optA.getAttribute("class");
    console.log("Option A classes after click:", optAClass);
    console.log("Option A selected?:", optAClass?.includes("sky-600") || optAClass?.includes("bg-sky"));
  }

  await page.screenshot({ path: "test_screenshots/q54_after_click.png" });
  await browser.close();
}

run().catch(console.error);
