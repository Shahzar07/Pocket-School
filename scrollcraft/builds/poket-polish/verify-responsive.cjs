// Regression checks for narrow layouts, scroll transitions and reveal timing.
// Run after npm run build. PLAYWRIGHT_MODULE, CHROME_PATH and HOME_QA_OUTPUT
// have the same meaning as in verify-home.cjs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const output =
  process.env.HOME_QA_OUTPUT || path.join(__dirname, "evidence/responsive");
fs.mkdirSync(output, { recursive: true });
(async () => {
  const server = require("node:child_process").spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3102",
    ],
    { stdio: "ignore" },
  );
  process.on("exit", () => server.kill());
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch("http://127.0.0.1:3102")).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const errors = [],
    results = [];
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem(
      "poket-cookie-consent",
      JSON.stringify({ essential: true, decidedAt: new Date().toISOString() }),
    );
    window.homeAnimations = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.closest("main"))
        window.homeAnimations.push({ target: this, animation });
      return animation;
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const jump = async (y) => {
    await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(100);
  };
  for (const width of [
    320, 360, 390, 640, 641, 768, 800, 801, 900, 901, 1024, 1280, 1536,
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:3102");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const initial = await page.evaluate(() => {
      const rect = (selector) =>
        document.querySelector(selector).getBoundingClientRect();
      const copy = rect("[class*=heroCopy]");
      const phone = rect("[class*=heroShowcase] > [class*=phone]");
      const header = rect("header");
      const controls = [...document.querySelectorAll("header a, header button")]
        .filter((e) => e.getBoundingClientRect().width > 0)
        .map((e) => e.getBoundingClientRect());
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        clearance: phone.top - copy.bottom,
        headerHeight: header.height,
        headerFits: controls.every((r) => r.left >= 0 && r.right <= innerWidth),
        // A wrapped sign-in label was a defect at intermediate widths.
        navFits: [...document.querySelectorAll("header nav a")].every(
          (e) => !e.offsetWidth || e.getBoundingClientRect().height <= 44,
        ),
      };
    });
    assert(
      !initial.overflow && initial.headerFits && initial.navFits,
      `Header/layout ${width}: ${JSON.stringify(initial)}`,
    );
    assert(
      initial.clearance >= 40,
      `Hero buttons clear phone ${width}: ${initial.clearance}`,
    );
    await jump(100);
    assert.equal(
      await page
        .getByRole("banner")
        .evaluate((e) => e.getBoundingClientRect().height),
      initial.headerHeight,
      `Header must not jump at scroll threshold ${width}`,
    );
    assert(
      await page.evaluate(() => {
        const copy = document
          .querySelector("[class*=heroCopy]")
          .getBoundingClientRect();
        const phone = document
          .querySelector("[class*=heroShowcase] > [class*=phone]")
          .getBoundingClientRect();
        return phone.top > copy.bottom + 24;
      }),
      `Parallax clearance ${width}`,
    );
    if (width <= 800) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("link", { name: "Features", exact: true })
        .click();
      await page.waitForTimeout(1100);
      assert(
        await page
          .locator("#features h2")
          .evaluate(
            (e) =>
              e.getBoundingClientRect().top >=
              document.querySelector("header").getBoundingClientRect().bottom,
          ),
        `Anchor ${width}`,
      );
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.keyboard.press("Escape");
      assert(
        await page
          .getByRole("button", { name: "Open navigation" })
          .evaluate((e) => e === document.activeElement),
      );
    }
    await page.getByRole("button", { name: "Yearly" }).click();
    await page.getByText("$14.25", { exact: true }).waitFor();
    await page.getByText("$171 billed yearly · USD", { exact: true }).waitFor();
    const cta = page.locator("main > section").last();
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(850);
    assert(
      await cta.evaluate((e) => {
        const copy = e
          .querySelector("[class*=ctaInner] > div:first-child")
          .getBoundingClientRect();
        const phone = e
          .querySelector("[class*=compactPhone]")
          .getBoundingClientRect();
        return phone.top >= copy.bottom + 20 || phone.left >= copy.right + 20;
      }),
      `Closing copy/phone separation ${width}`,
    );
    assert(
      await page.evaluate(() =>
        [...document.querySelectorAll("[class*=priceAction]")].every(
          (e) => e.scrollWidth <= e.clientWidth + 1,
        ),
      ),
      `Price row ${width}`,
    );
    if ([320, 390, 641, 768, 901, 1280].includes(width)) {
      await page.screenshot({ path: path.join(output, `cta-${width}.png`) });
      await jump(0);
      await page.screenshot({
        path: path.join(output, `full-${width}.png`),
        fullPage: true,
      });
    }
    results.push({
      width,
      layout: "passed",
      header: "passed",
      controls: "passed",
    });
    console.log("Passed width", width);
  }
  // Sample all staggered bars during their delay: none should flash at full size.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:3102");
  await page.waitForTimeout(200);
  await page.locator("[data-home-reveal=chart]").evaluate((e) =>
    scrollTo({
      top: e.getBoundingClientRect().top + scrollY - 400,
      behavior: "instant",
    }),
  );
  await page.waitForFunction(() =>
    window.homeAnimations.some(({ target }) =>
      target.hasAttribute("data-home-bar"),
    ),
  );
  const scales = await page
    .locator("[data-home-bar]")
    .evaluateAll((bars) =>
      bars.map((bar) => new DOMMatrix(getComputedStyle(bar).transform).m22),
    );
  assert(
    scales.every((scale) => scale < 0.99),
    `Stagger flash: ${scales}`,
  );
  const count = await page.evaluate(() => window.homeAnimations.length);
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator("main")
      .evaluate((e) => e.getAnimations({ subtree: true }).length),
    0,
    "Changing motion preference cancels in-flight reveals",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => window.homeAnimations.length),
    count,
    "Motion toggle must not replay visible content",
  );
  await jump(0);
  await page.locator("[data-home-reveal=chart]").evaluate((e) =>
    scrollTo({
      top: e.getBoundingClientRect().top + scrollY - 400,
      behavior: "instant",
    }),
  );
  await page.waitForTimeout(100);
  assert.equal(
    await page
      .locator("[data-home-bar]")
      .evaluateAll((bars) => bars.flatMap((e) => e.getAnimations()).length),
    0,
    "Chart plays once",
  );
  // Restored deep links must not animate backwards after hydration.
  await page.goto("http://127.0.0.1:3102/#progress");
  await page.waitForTimeout(900);
  assert.equal(
    await page
      .locator("[data-home-bar]")
      .evaluateAll((bars) => bars.flatMap((e) => e.getAnimations()).length),
    0,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await jump(0);
  assert.equal(
    await page
      .locator("main")
      .evaluate((e) => e.getAnimations({ subtree: true }).length),
    0,
  );
  // Crossing the navigation breakpoint must dismiss the open mobile menu.
  await page.setViewportSize({ width: 800, height: 900 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.setViewportSize({ width: 801, height: 900 });
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .waitFor({ state: "detached" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page
      .getByRole("button", { name: "Open navigation" })
      .getAttribute("aria-expanded"),
    "false",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, "results.json"),
    JSON.stringify({ results, motion: "passed", errors }, null, 2),
  );
  await browser.close();
  server.kill();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
