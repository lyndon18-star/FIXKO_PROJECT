/* Screenshot key landing-page states for visual QA. */
const { chromium } = require("playwright");

const BASE = "http://localhost:3457";
const shots = [
  { name: "hero-desktop", width: 1440, height: 900, y: 0 },
  { name: "faq-desktop", width: 1440, height: 900, selector: "#faq", minH: 2600 },
  { name: "hero-mobile", width: 390, height: 844, y: 0 },
  { name: "faq-mobile", width: 390, height: 844, selector: "#faq", minH: 3200 },
];

(async () => {
  const browser = await chromium.launch();
  for (const shot of shots) {
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500);
    if (shot.selector) {
      await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView(), shot.selector);
      await page.waitForTimeout(700);
      // open one FAQ card to see expanded state
      await page.click("#faq .faq-card button");
      await page.waitForTimeout(500);
    } else {
      await page.evaluate((y) => window.scrollTo(0, y), shot.y);
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `../shots/${shot.name}.png`, fullPage: false });
    await page.close();
  }
  await browser.close();
  console.log("SCREENSHOTS DONE");
})().catch((err) => { console.error(err); process.exit(1); });
