// Renders the exported billboard tree GLB in headless Chrome so the asset can be
// inspected exactly as Three.js will load it. Requires `npm run dev` on port 5173.
import { mkdirSync, existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const exe = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));
if (!exe) throw new Error('No Chrome/Edge found');

mkdirSync('shots', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--hide-scrollbars',
    '--mute-audio',
  ],
  defaultViewport: { width: 900, height: 1050, deviceScaleFactor: 1 },
});

const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  const query = process.env.PREVIEW_QUERY || '';
  await page.goto('http://localhost:5173/glb-preview.html' + query, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction('window.__ready === true || window.__error', { timeout: 45000 });
  const err = await page.evaluate(() => window.__error || null);
  if (err) throw new Error(err);
  const info = await page.evaluate(() => window.__info);

  const prefix = process.env.SHOT_PREFIX || 'glb';
  await page.evaluate(() => window.__setView('hero'));
  for (const t of [0, 1, 2, 3]) {
    await page.evaluate((time) => window.__setTime(time), t);
    await page.screenshot({ path: `shots/${prefix}-hero-t${t}.png` });
  }
  for (const view of ['front', 'side', 'low', 'crown', 'base']) {
    await page.evaluate((v) => window.__setView(v), view);
    await page.evaluate(() => window.__setTime(1.35));
    await page.screenshot({ path: `shots/${prefix}-${view}.png` });
  }
  console.log(JSON.stringify({ info, errors }, null, 2));
} catch (e) {
  console.error(JSON.stringify({ error: String(e && e.stack ? e.stack : e), errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
