// Dev-only: screenshot the upgrade web.
// Usage: node scripts/shot-workshop.mjs --port 5173 --world 0 --ranks 12 --out shots/workshop.png
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const port = Number(arg('port', 5173));
const world = Number(arg('world', 0));
const ranks = Number(arg('ranks', 12));
const out = String(arg('out', 'shots/workshop.png'));
const wait = Number(arg('wait', 1500));

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
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1600,900'],
  defaultViewport: { width: 1600, height: 900 },
});
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/?fresh`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__rain && window.__rain.state', { timeout: 60000 });
  await page.waitForFunction('window.__rain.state.screen === "start"', { timeout: 60000 });
  await page.evaluate(
    ({ world, ranks }) => {
      const game = window.__rain;
      game.devJump(world, 0);
      const state = game.state;
      const order = [
        'puff', 'puff', 'puff', 'puff', 'puff', 'puff', 'puff', 'puff',
        'bottle', 'flask', 'drizzle', 'specks', 'reach', 'circle', 'sprinkler',
      ];
      for (let i = 0; i < Math.min(ranks, order.length); i += 1) state.ranks[order[i]] += 1;
      state.blooms = 14;
      state.phase = 'dry';
      state.screen = 'workshop';
      game.pushHud ? game.pushHud(true) : null;
    },
    { world, ranks },
  );
  await new Promise((r) => setTimeout(r, wait));
  await page.screenshot({ path: out });
  console.log(`shot ${out}`);
} finally {
  await browser.close();
}
