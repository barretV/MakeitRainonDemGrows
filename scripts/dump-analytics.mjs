// Dev-only: play the game for a few bottles and dump the real earnings ledger.
// Usage: node scripts/dump-analytics.mjs --port 5173 --world 0 --bottles 6 --out balance/play-world0.json
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const port = Number(arg('port', 5173));
const world = Number(arg('world', 0));
const bottles = Number(arg('bottles', 6));
const out = String(arg('out', 'balance/play.json'));

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
  protocolTimeout: 0,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=640,360'],
  defaultViewport: { width: 640, height: 360 },
});
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/?fresh`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__rain && window.__rain.state', { timeout: 60000 });
  await page.waitForFunction('window.__rain.state.screen === "start"', { timeout: 60000 });
  await page.evaluate((w) => {
    const game = window.__rain;
    game.devJump(w, 0);
    game.goto(w);
  }, world);
  const started = await page.evaluate(() => window.__rain.state.runLog.length);
  // The bottle pours on its own; the ledger fills one entry per bottle. The game
  // waits on the results screen between bottles, so the bot pours the next one.
  const target = started + bottles;
  const deadline = Date.now() + 30 * 60 * 1000;
  while (Date.now() < deadline) {
    const done = await page.evaluate(() => {
      const game = window.__rain;
      if (!game || !game.state) return -1;
      if (game.state.phase === 'dry' || game.state.phase === 'clear') game.retry();
      return game.state.runLog.length;
    });
    if (done < 0) {
      // The page reloaded (hot reload). Wait for the game to come back.
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (done >= target) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const data = await page.evaluate(() => window.__rain.analytics());
  writeFileSync(out, JSON.stringify(data, null, 2));
  console.log(`wrote ${out} (${data.runs.length} bottles)`);
} finally {
  await browser.close();
}
