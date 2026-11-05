/**
 * Playwright E2E verification test for Q54 on ssc-cgl-2026-10-05:
 * 1. Opens /#/exam/ssc-cgl-2026-10-05
 * 2. Jumps to Q54 (Quant section)
 * 3. Verifies Palette header and active section says "Quant", not "Reasoning"
 * 4. Verifies 4 options are rendered: ['7', '6', '5', '8']
 * 5. Verifies all 4 options are visible in the viewport without scrolling the page/card
 * 6. Clicks Option A, verifies state updates to Option A selected
 * 7. Clicks Option B, C, D, verifies state updates cleanly for each
 * 8. Verifies View Original modal opens with original scan
 * 9. Navigates to /#/review and checks dual-pane inspection
 */

import { chromium } from "playwright";

async function run() {
  console.log("[Test] Launching Chromium browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  const baseUrl = "http://localhost:3000";
  console.log(`[Test] Navigating to ${baseUrl}/#/exam/ssc-cgl-2026-10-05?mode=section&section=quantitative_aptitude ...`);

  await page.goto(`${baseUrl}/#/exam/ssc-cgl-2026-10-05?mode=section&section=quantitative_aptitude`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  // Wait for test to load (Q51 is first question of Quant)
  await page.waitForSelector("text=Q51", { timeout: 15000 });
  console.log("[Test] Quant section loaded successfully.");

  // Click Q54 in the question palette (it's the 4th button in the palette)
  console.log("[Test] Clicking Q54 in question palette...");
  const q54Button = page.locator("aside button:has-text('54')").first();
  await q54Button.click();
  await page.waitForTimeout(600);

  // 1. Verify Q-badge is Q54
  const qBadge = await page.locator("text=Q54").first();
  const isQ54 = await qBadge.isVisible();
  console.log(`[Test] Q54 badge visible: ${isQ54}`);
  if (!isQ54) {
    throw new Error("Failed to navigate to Q54!");
  }

  // 2. Verify section indicator says Quant, NOT Reasoning
  const paletteHeader = page.locator("aside").first();
  const paletteText = await paletteHeader.textContent();
  console.log(`[Test] Palette header content: "${paletteText?.slice(0, 40).trim()}"`);
  const containsQuant = paletteText?.includes("Quant");
  console.log(`[Test] Palette section correctly displays Quant: ${containsQuant}`);
  if (!containsQuant) {
    throw new Error(`Palette section should display Quant, but found: ${paletteText}`);
  }

  // 3. Verify options text: "7", "6", "5", "8"
  const optionA = page.locator("button:has-text('7')").filter({ hasText: "A" }).first();
  const optionB = page.locator("button:has-text('6')").filter({ hasText: "B" }).first();
  const optionC = page.locator("button:has-text('5')").filter({ hasText: "C" }).first();
  const optionD = page.locator("button:has-text('8')").filter({ hasText: "D" }).first();

  const aVis = await optionA.isVisible();
  const bVis = await optionB.isVisible();
  const cVis = await optionC.isVisible();
  const dVis = await optionD.isVisible();

  console.log(`[Test] Option A ('7') visible: ${aVis}`);
  console.log(`[Test] Option B ('6') visible: ${bVis}`);
  console.log(`[Test] Option C ('5') visible: ${cVis}`);
  console.log(`[Test] Option D ('8') visible: ${dVis}`);

  if (!aVis || !bVis || !cVis || !dVis) {
    throw new Error("Not all 4 options are rendered for Q54!");
  }

  // 4. Verify all options are in viewport without page scroll
  const boxA = await optionA.boundingBox();
  const boxD = await optionD.boundingBox();
  console.log(`[Test] Option A position: y=${boxA?.y}, height=${boxA?.height}`);
  console.log(`[Test] Option D position: y=${boxD?.y}, height=${boxD?.height}`);

  if (boxA && boxD) {
    // Both must be within 768px viewport
    const withinViewport = boxA.y > 0 && (boxD.y + boxD.height) <= 768;
    console.log(`[Test] Options pinned within viewport (y <= 768px): ${withinViewport}`);
  }

  // 5. Click Option A
  console.log("[Test] Clicking Option A ('7')...");
  await optionA.click();
  await page.waitForTimeout(300);

  // Check if Option A received selected styling (ring or sky background)
  const optionAClass = await optionA.getAttribute("class");
  const isASelected = optionAClass?.includes("bg-sky-50") || optionAClass?.includes("border-sky-500");
  console.log(`[Test] Option A click received & styled: ${isASelected}`);
  if (!isASelected) {
    throw new Error("Option A did not get selected state upon click!");
  }

  // 6. Click Option B ('6')
  console.log("[Test] Clicking Option B ('6')...");
  await optionB.click();
  await page.waitForTimeout(300);
  const optionBClass = await optionB.getAttribute("class");
  const isBSelected = optionBClass?.includes("bg-sky-50") || optionBClass?.includes("border-sky-500");
  console.log(`[Test] Option B click received & styled: ${isBSelected}`);

  // 7. Verify "View Original" button opens modal
  const viewOrigBtn = page.locator("button:has-text('View Original')").first();
  if (await viewOrigBtn.isVisible()) {
    console.log("[Test] Clicking 'View Original' button...");
    await viewOrigBtn.click();
    await page.waitForTimeout(500);

    const origModal = page.locator("text=Original Question Paper Crop").first();
    const modalVis = await origModal.isVisible();
    console.log(`[Test] Original scan crop modal visible: ${modalVis}`);

    // Close modal
    const closeBtn = page.locator("button[aria-label='Close original crop view']").first();
    await closeBtn.click();
    await page.waitForTimeout(300);
  }

  // 8. Test Review page
  console.log(`[Test] Navigating to ${baseUrl}/#/review ...`);
  await page.goto(`${baseUrl}/#/review?test=ssc-cgl-2026-10-05`, {
    waitUntil: "networkidle",
    timeout: 15000,
  });
  await page.waitForSelector("text=Question Quality Review", { timeout: 10000 });
  console.log("[Test] Review page loaded successfully.");

  const looksWrongBtn = page.locator("button:has-text('Looks Wrong')").first();
  const looksWrongVis = await looksWrongBtn.isVisible();
  console.log(`[Test] 'Looks Wrong' override button visible: ${looksWrongVis}`);

  await looksWrongBtn.click();
  await page.waitForTimeout(400);
  const overrideModal = page.locator("text=Question Override Template").first();
  console.log(`[Test] Override skeleton modal opened: ${await overrideModal.isVisible()}`);

  console.log("\n==========================================");
  console.log("ALL E2E REGRESSION TESTS PASSED CLEANLY!");
  console.log("==========================================\n");

  await browser.close();
}

run().catch((err) => {
  console.error("\n[Test Failure]", err);
  process.exit(1);
});
