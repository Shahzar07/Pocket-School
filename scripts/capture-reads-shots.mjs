import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
});

const consent = {
  essential: true,
  functional: true,
  analytics: false,
  aiPerformance: false,
  decidedAt: '2026-01-01T00:00:00.000Z',
};

async function shot(name, url, viewport, after) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(prefs => {
    localStorage.setItem('poket-cookie-consent', JSON.stringify(prefs));
  }, consent);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  if (after) await after(page);
  await new Promise(resolve => setTimeout(resolve, 400));
  await page.screenshot({ path: `/tmp/reads-shots/${name}.png` });
  await page.close();
  console.log('shot', name);
}

await mkdir('/tmp/reads-shots', { recursive: true });

await shot('phone-shelf', 'http://127.0.0.1:3000/reads', { width: 390, height: 844, deviceScaleFactor: 2 });
await shot('tablet-reader', 'http://127.0.0.1:3000/reads/read/harbour-light', {
  width: 834,
  height: 1112,
  deviceScaleFactor: 2,
}, async page => {
  await page.waitForFunction(() => document.body.innerText.includes('Harbour') || document.body.innerText.includes('jetty'), { timeout: 20000 });
});
await shot('laptop-ask', 'http://127.0.0.1:3000/reads/read/harbour-light', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
}, async page => {
  await page.waitForFunction(() => document.body.innerText.includes('Harbour') || document.body.innerText.includes('jetty'), { timeout: 20000 });
  const ask = await page.$('button[aria-label="Ask ET"]');
  if (!ask) throw new Error('Ask ET button missing');
  await ask.click();
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes('ask'), { timeout: 10000 });
});

await browser.close();
