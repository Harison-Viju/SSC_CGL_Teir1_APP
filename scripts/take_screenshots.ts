import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function main() {
  const artifactDir = "/.aistudio/artifacts/brain/2da674c1-f956-40b2-9876-4ed91270c510";
  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "mobile_390x844", width: 390, height: 844 },
    { name: "desktop_1366x768", width: 1366, height: 768 },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
    });
    await page.goto("http://localhost:3000/#/", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const outPath = path.join(artifactDir, `p1_${vp.name}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved screenshot to ${outPath}`);
    await page.close();
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
