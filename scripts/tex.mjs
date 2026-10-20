// Dev helper: dump a procedural canvas texture from the running game to a PNG.
// Usage: node scripts/tex.mjs [port] <js-expression> <out.png> [world]
import { existsSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const port = Number(process.argv[2] ?? 5173);
const expr = process.argv[3] ?? 'art.grove[1]';
const out = process.argv[4] ?? 'shots/tex.png';
const world = Number(process.argv[5] ?? 0);

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const exe = candidates.find((p) => existsSync(p));
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
  defaultViewport: { width: 900, height: 600, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  await page.goto(`http://localhost:${port}/?fresh`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__rain && window.__rain.art', { timeout: 60000 });
  if (world) await page.evaluate((w) => window.__rain.devJump(w, 0), world);
  await new Promise((r) => setTimeout(r, 800));
  const data = await page.evaluate(
    ({ code, pts }) => {
      // eslint-disable-next-line no-new-func
      const tex = new Function('rain', 'art', `return (${code});`)(window.__rain, window.__rain.art);
      const img = tex && tex.image;
      const samples = [];
      if (img && pts.length) {
        const ctx = img.getContext ? img.getContext('2d') : null;
        if (ctx) {
          for (const [sx, sy] of pts) {
            const d = ctx.getImageData(sx, sy, 1, 1).data;
            samples.push(`(${sx},${sy}) rgba(${d[0]},${d[1]},${d[2]},${d[3]})`);
          }
        }
      }
      if (!img) return { err: `no image on ${code}` };
      if (img.toDataURL) return { url: img.toDataURL(), w: img.width, h: img.height, samples };
      return { err: 'image has no toDataURL' };
    },
    {
      code: expr,
      pts: (process.argv[6] ?? '')
        .split(';')
        .filter(Boolean)
        .map((p) => p.split(',').map(Number)),
    },
  );
  if (data.err) {
    console.log('ERR', data.err);
  } else {
    const b64 = data.url.split(',')[1];
    writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(`wrote ${out} (${data.w}x${data.h})`);
    for (const s of data.samples ?? []) console.log('px', s);
  }
} finally {
  await browser.close();
}
