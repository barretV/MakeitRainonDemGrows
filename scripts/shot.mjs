// Visual QA helper: boots the dev server page in a headless browser and takes
// staged screenshots. Usage:
//   node scripts/shot.mjs --world 0 --soak 0.4 --rain 1 --out shots/w0.png
// Requires `npm run dev` running on the port below and a local Chrome/Edge.
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};

const port = Number(arg('port', 5173));
const world = Number(arg('world', 0));
const soak = Number(arg('soak', 0));
const out = String(arg('out', `shots/w${world}-${soak}.png`));
const wait = Number(arg('wait', 3200));
const rain = arg('rain', '0') === '1';
const hud = arg('hud', '1') === '1';
const shots = Number(arg('shots', 1));
const gap = Number(arg('gap', 800));
const zoom = Number(arg('zoom', 0));
const camYaw = Number(arg('yaw', 0));
const dsf = Number(arg('dsf', 1));
const clipArg = String(arg('clip', ''));
/** Keep the boot world picker open instead of jumping straight into a run. */
const menu = arg('menu', '0') === '1';

const browserCandidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const exe = browserCandidates.find((p) => existsSync(p));
if (!exe) throw new Error('No Chrome/Edge found');

mkdirSync(path.dirname(out), { recursive: true });

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
    '--window-size=1600,900',
  ],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: dsf },
});

const clip = clipArg
  ? (() => {
      const parts = clipArg.split(',').map(Number);
      if (parts.length === 4) {
        const [x0, y0, x1, y1] = parts;
        return {
          x: Math.round(1600 * x0),
          y: Math.round(900 * y0),
          width: Math.round(1600 * (x1 - x0)),
          height: Math.round(900 * (y1 - y0)),
        };
      }
      const [a, b] = parts;
      return { x: 0, y: Math.round(900 * a), width: 1600, height: Math.round(900 * (b - a)) };
    })()
  : undefined;

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(`http://localhost:${port}/?fresh`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__rain && window.__rain.state', { timeout: 60000 });
  await page.waitForFunction('window.__rain.frame > 0', { timeout: 30000 });
  await page.evaluate(
    ({ world, soak, menu }) => {
      const rain = window.__rain;
      if (menu) return;
      rain.devJump(world, 0);
      if (soak > 0) rain.devSoak(soak);
    },
    { world, soak, menu },
  );
  if (!hud) {
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const stage = canvas?.closest('.relative');
      if (!stage) return;
      for (const child of [...stage.children]) {
        if (!child.contains(canvas)) child.style.display = 'none';
      }
    });
  }
  if (zoom > 0 || camYaw !== 0) {
    await page.evaluate(
      ({ zoom, camYaw }) => {
        if (zoom > 0) window.__rain.setCamZoom(zoom);
        if (camYaw !== 0) window.__rain.camYaw = camYaw;
      },
      { zoom, camYaw },
    );
  }
  await new Promise((r) => setTimeout(r, wait));
  if (rain) {
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.42 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    // let the pour fade in and the first drops fall into frame
    await new Promise((r) => setTimeout(r, 1100));
    const dbg = await page.evaluate(() => {
      const g = window.__rain;
      return {
        mouseRain: !!g.mouseRain,
        rainMix: +(g.rainMix ?? 0).toFixed(2),
        curtain: !!g.curtain?.visible,
        curtainScale: g.curtain ? [g.curtain.scale.x.toFixed(1), g.curtain.scale.y.toFixed(1)] : null,
        tank: +(g.state?.tank ?? 0).toFixed(2),
        held: !!g.held,
      };
    });
    console.log('rain state', JSON.stringify(dbg));
  }
  for (let i = 0; i < shots; i += 1) {
    if (i > 0) await new Promise((r) => setTimeout(r, gap));
    const file = shots > 1 ? out.replace(/\.png$/, `-${i + 1}.png`) : out;
    await page.screenshot(clip ? { path: file, clip } : { path: file });
    console.log(`shot ${file}`);
  }
  if (rain) await page.mouse.up();
  if (errors.length) {
    console.log('--- page errors ---');
    for (const e of errors.slice(0, 8)) console.log(e);
  }
} finally {
  await browser.close();
}
