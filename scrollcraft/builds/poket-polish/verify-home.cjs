const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("fs"),
  assert = require("assert/strict");
const base =
  process.env.HOME_QA_OUTPUT ||
  require("path").join(
    process.cwd(),
    "scrollcraft/builds/poket-polish/evidence",
  );
fs.mkdirSync(base + "/shots", { recursive: true });
(async () => {
  const server = require("child_process").spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    { stdio: "inherit" },
  );
  process.on("exit", () => server.kill());
  for (let i = 0; i < 45; i++) {
    try {
      if ((await fetch("http://127.0.0.1:3100")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const results = [],
    errors = [];
  for (const [label, width, height, reduced] of [
    ["desktop", 1280, 900, false],
    ["tablet", 768, 1024, false],
    ["phone", 390, 844, false],
    ["compact", 360, 640, false],
    ["reduced", 1280, 900, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: reduced ? "reduce" : "no-preference",
      deviceScaleFactor: 1,
    });
    await context.addInitScript(() => {
      Element.prototype.requestPointerLock = function () {};
      Element.prototype.setPointerCapture = function () {};
      Element.prototype.releasePointerCapture = function () {};
      localStorage.setItem(
        "poket-cookie-consent",
        JSON.stringify({
          essential: true,
          functional: false,
          analytics: false,
          aiPerformance: false,
          decidedAt: new Date().toISOString(),
        }),
      );
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push({ label, message: e.message }));
    await page.goto("http://127.0.0.1:3100", { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    console.log("Loaded", label);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "No overflow " + label,
    );
    const hero = page.locator("[data-home-hero]");
    assert.equal(
      await hero.evaluate((e) => getComputedStyle(e).overflowY),
      "clip",
    );
    const heroHeight = await hero.evaluate((e) => e.offsetHeight);
    await page.screenshot({ path: `${base}/shots/${label}-opening.png` });
    await page.evaluate(
      (y) => scrollTo({ top: y, behavior: "instant" }),
      heroHeight * 0.45,
    );
    await page.waitForTimeout(300);
    const depth = await hero.evaluate((e) =>
      Number(e.style.getPropertyValue("--hero-depth")),
    );
    if (!reduced && width > 640)
      assert(depth > 0.35 && depth < 0.6, "Depth responds to scrolling");
    else assert.equal(depth, 0);
    await page.screenshot({ path: `${base}/shots/${label}-middle.png` });
    await page.evaluate(
      (y) => scrollTo({ top: y, behavior: "instant" }),
      heroHeight - 180,
    );
    await page.waitForTimeout(900);
    const strip = page.getByRole("navigation", { name: "Learning pathways" });
    assert(
      await strip.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return e.contains(
          document.elementFromPoint(innerWidth / 2, r.top + r.height / 2),
        );
      }),
      "Phone does not cover pathways",
    );
    await page.screenshot({ path: `${base}/shots/${label}-exit.png` });
    for (const section of ["features", "difference", "progress", "pricing"]) {
      await page.locator("#" + section).scrollIntoViewIfNeeded();
      await page.waitForTimeout(950);
      await page.screenshot({ path: `${base}/shots/${label}-${section}.png` });
    }
    await page.getByRole("button", { name: "Yearly" }).click();
    await page.getByText("$14.25", { exact: true }).waitFor();
    await page.getByText("$171 billed yearly · USD", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Monthly", exact: true }).click();
    await page.getByText("$19", { exact: true }).waitFor();
    if (width <= 640) {
      const clear = await page
        .locator("main > section")
        .last()
        .evaluate((e) => {
          const copy = e
            .querySelector("[class*=ctaInner] > div:first-child")
            .getBoundingClientRect();
          const phone = e
            .querySelector("[data-home-reveal=phone]")
            .getBoundingClientRect();
          return phone.top >= copy.bottom + 20;
        });
      assert(clear, "Closing phone clears all CTA controls");
    }
    await page.locator("main > section").last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${base}/shots/${label}-cta.png` });
    if (width <= 640) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("navigation", { name: "Mobile navigation" })
        .waitFor();
      await page.keyboard.press("Escape");
      assert(
        await page
          .getByRole("button", { name: "Open navigation" })
          .evaluate((e) => e === document.activeElement),
      );
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("link", { name: "Features", exact: true })
        .click();
      await page.waitForTimeout(1200);
      assert(
        await page
          .locator("#features h2")
          .evaluate((e) => e.getBoundingClientRect().top >= 85),
        "Anchor clears header",
      );
      await strip.locator("a").last().focus();
      assert(
        await strip.evaluate((e) => e.scrollLeft > 0),
        "Pathways keyboard scroll",
      );
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(100);
    assert.equal(
      await hero.evaluate((e) => e.style.getPropertyValue("--hero-depth")),
      "",
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector("main").getAnimations({ subtree: true })
            .length,
      ),
      0,
    );
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `${base}/shots/${label}-full.png`,
      fullPage: true,
    });
    results.push({
      label,
      width,
      height,
      layout: "passed",
      pricing: "passed",
      reducedMotion: "passed",
    });
    console.log("Passed", label);
    await context.close();
  }
  assert.equal(errors.length, 0, JSON.stringify(errors));
  fs.writeFileSync(
    base + "/shots/results.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(JSON.stringify({ results, errors }));
  await browser.close();
  server.kill();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
