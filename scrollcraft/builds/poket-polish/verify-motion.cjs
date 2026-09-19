const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("assert/strict");
const fs = require("fs");
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
      "3101",
    ],
    { stdio: "ignore" },
  );
  process.on("exit", () => server.kill());
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch("http://127.0.0.1:3101")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {};
    Element.prototype.setPointerCapture = function () {};
    Element.prototype.releasePointerCapture = function () {};
    localStorage.setItem("poket-cookie-consent", "{}");
  });
  await page.goto("http://127.0.0.1:3101", { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    scrollTo({
      top: document.querySelector("#progress").offsetTop - 180,
      behavior: "instant",
    }),
  );
  await page.waitForTimeout(60);
  const before = await page
    .locator("[data-home-bar]")
    .first()
    .evaluate((e) => getComputedStyle(e).transform);
  await page.screenshot({ path: base + "/shots/chart-start.png" });
  await page.waitForTimeout(1000);
  const after = await page
    .locator("[data-home-bar]")
    .first()
    .evaluate((e) => getComputedStyle(e).transform);
  assert.notEqual(before, after, "Chart progresses");
  await page.screenshot({ path: base + "/shots/chart-finish.png" });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(100);
  await page.evaluate(() =>
    scrollTo({
      top: document.querySelector("#progress").offsetTop - 180,
      behavior: "instant",
    }),
  );
  await page.waitForTimeout(80);
  assert.equal(
    await page
      .locator("[data-home-bar]")
      .first()
      .evaluate((e) => e.getAnimations().length),
    0,
    "Chart only animates once",
  );
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const staticPage = await context.newPage();
  await staticPage.goto("http://127.0.0.1:3101", { waitUntil: "load" });
  assert(await staticPage.getByRole("heading", { level: 1 }).isVisible());
  assert(
    await staticPage
      .getByRole("link", { name: "Start learning for free", exact: true })
      .first()
      .isVisible(),
  );
  await staticPage.screenshot({ path: base + "/shots/no-js.png" });
  fs.writeFileSync(
    base + "/shots/motion-results.json",
    JSON.stringify(
      {
        chartStarts: before,
        chartFinishes: after,
        chartPlaysOnce: true,
        noJavascriptHeroVisible: true,
      },
      null,
      2,
    ),
  );
  await browser.close();
  server.kill();
  console.log(
    "Chart animation, one-time playback and no-JavaScript fallback passed",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
