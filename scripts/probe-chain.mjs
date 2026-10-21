// Dev probe: the chain multiplier and the next-goal strip in play.
import { existsSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
mkdirSync('shots', { recursive: true });
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1600,900'],
  defaultViewport: { width: 1600, height: 900 },
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 250)));
  await page.goto('http://localhost:5173/?fresh', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__rain && window.__rain.state', { timeout: 60000 });
  await page.waitForFunction('window.__rain.state.screen === "start"', { timeout: 60000 });
  await page.evaluate(() => {
    const g = window.__rain;
    g.devJump(0, 0);
    // put some money in the pocket so the next-goal bar has something to show
    g.state.dew = 1200;
    g.state.ranks.puff = 3;
  });
  await new Promise((r) => setTimeout(r, 4000));
  const info = await page.evaluate(() => ({
    chain: +window.__rain.state.chainMultiplier().toFixed(2),
    runTiles: window.__rain.state.runTiles,
    goal: window.__rain.state.nextGoal(),
    chainChip: document.querySelector('.hud-chain')?.textContent ?? null,
    goalChip: document.querySelector('.hud-goal')?.textContent ?? null,
  }));
  console.log(JSON.stringify(info));
  await page.screenshot({ path: 'shots/chain.png' });
  console.log('shot');
} finally {
  await browser.close();
}
