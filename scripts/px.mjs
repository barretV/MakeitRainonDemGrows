// Dev helper: sample pixel colours from a local PNG (renders it in a headless page).
// Usage: node scripts/px.mjs <png> "x,y;x,y;..." [scale]
import { existsSync, readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const file = process.argv[2] ?? 'shots/shot.png';
const pts = (process.argv[3] ?? '')
  .split(';')
  .filter(Boolean)
  .map((p) => p.split(',').map(Number));

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const exe = candidates.find((p) => existsSync(p));
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--no-sandbox'],
  defaultViewport: { width: 400, height: 300 },
});
try {
  const page = await browser.newPage();
  const b64 = readFileSync(file).toString('base64');
  await page.setContent(`<img id="i" src="data:image/png;base64,${b64}">`);
  await page.waitForFunction('document.getElementById("i").complete');
  const out = await page.evaluate(({ pts }) => {
    const img = document.getElementById('i');
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const rows = [`size ${c.width}x${c.height}`];
    for (const [x, y] of pts) {
      const d = ctx.getImageData(x, y, 1, 1).data;
      rows.push(`(${x},${y}) rgb(${d[0]},${d[1]},${d[2]}) #${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    }
    return rows;
  }, { pts });
  for (const line of out) console.log(line);
} finally {
  await browser.close();
}
