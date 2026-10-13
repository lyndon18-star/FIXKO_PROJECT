/* Landing page UI audit: logs console errors, horizontal overflow, overlapping elements,
   broken images, and zero-size interactive elements across viewports and themes. */
const { chromium } = require("playwright");

const BASE = "http://localhost:3457";
const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
];

(async () => {
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text().slice(0, 300));
      });
      page.on("pageerror", (err) => errors.push(`PAGEERROR: ${String(err).slice(0, 300)}`));
      await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
      await page.evaluate((t) => {
        window.localStorage.setItem("fixko-theme", t);
      }, theme);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(1600);

      // 1. Horizontal overflow check
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const vw = doc.clientWidth;
        const bad = [];
        if (doc.scrollWidth > vw + 1) {
          document.querySelectorAll("body *").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right > vw + 6 || r.left < -6) && getComputedStyle(el).position !== "fixed") {
              const cls = (typeof el.className === "string" ? el.className : "").split(" ").slice(0, 3).join(".");
              bad.push(`${el.tagName.toLowerCase()}.${cls} right=${Math.round(r.right)} left=${Math.round(r.left)}`);
            }
          });
        }
        return { scrollW: doc.scrollWidth, vw, bad: bad.slice(0, 8) };
      });
      if (overflow.scrollW > overflow.vw + 1) {
        console.log(`[OVERFLOW] ${vp.name} ${theme}: scrollWidth ${overflow.scrollW} > viewport ${overflow.vw}`);
        overflow.bad.forEach((b) => console.log(`   → ${b}`));
      }

      // 2. Broken images
      const brokenImgs = await page.evaluate(() =>
        Array.from(document.images)
          .filter((img) => !img.complete || img.naturalWidth === 0)
          .map((img) => img.getAttribute("src"))
      );
      if (brokenImgs.length) console.log(`[BROKEN IMG] ${vp.name} ${theme}: ${brokenImgs.join(", ")}`);

      // 3. Overlapping sibling elements (visible elements with text)
      const overlaps = await page.evaluate(() => {
        const tags = [];
        const els = Array.from(document.querySelectorAll("h1,h2,h3,a,button,p,li")).filter((el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return r.width > 4 && r.height > 4 && style.visibility !== "hidden" && style.opacity !== "0" && (el.textContent || "").trim().length > 0;
        });
        for (let i = 0; i < els.length; i++) {
          for (let j = i + 1; j < els.length; j++) {
            const a = els[i], b = els[j];
            if (a.contains(b) || b.contains(a)) continue;
            const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            const ol = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
            const ot = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
            if (ol > 14 && ot > 8) {
              tags.push(`${short(a)} ⟂ ${short(b)} overlap ${Math.round(ol)}x${Math.round(ot)}`);
              if (tags.length > 12) return tags;
            }
          }
        }
        return tags;
        function short(el) {
          const cls = (typeof el.className === "string" ? el.className : "").split(" ")[0] || "";
          return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}[${(el.textContent || "").trim().slice(0, 24)}]`;
        }
      });
      if (overlaps.length) {
        console.log(`[OVERLAP] ${vp.name} ${theme}:`);
        overlaps.forEach((t) => console.log(`   → ${t}`));
      }

      // 4. Zero-size interactive elements
      const zeroBtns = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button,a")).filter((el) => {
          const r = el.getBoundingClientRect();
          return getComputedStyle(el).display !== "none" && (r.width < 4 || r.height < 4);
        }).map((el) => (typeof el.className === "string" ? el.className : "").split(" ")[0] || el.tagName.toLowerCase())
      );
      if (zeroBtns.length) console.log(`[ZERO-SIZE BTN] ${vp.name} ${theme}: ${zeroBtns.slice(0, 6).join(", ")}`);

      if (errors.length) {
        console.log(`[CONSOLE ERRORS] ${vp.name} ${theme}:`);
        [...new Set(errors)].slice(0, 6).forEach((e) => console.log(`   → ${e}`));
      }
      await page.close();
    }
  }
  await browser.close();
  console.log("AUDIT COMPLETE");
})().catch((err) => { console.error("AUDIT FAILED:", err); process.exit(1); });
