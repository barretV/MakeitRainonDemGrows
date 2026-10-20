// Dev probe: project key world points to screen NDC so backdrop placement is measurable.
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const port = Number(process.argv[2] ?? 5173);
const world = Number(process.argv[3] ?? 0);
const soak = Number(process.argv[4] ?? 0.15);

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const exe = candidates.find((p) => existsSync(p));
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1600,900'],
  defaultViewport: { width: 1600, height: 900, deviceScaleFactor: 1 },
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 200)));
  await page.goto(`http://localhost:${port}/?fresh`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__rain && window.__rain.state', { timeout: 60000 });
  await page.evaluate(({ world, soak }) => {
    window.__rain.devJump(world, 0);
    if (soak > 0) window.__rain.devSoak(soak);
  }, { world, soak });
  await new Promise((r) => setTimeout(r, 6000));
  const out = await page.evaluate(() => {
    const g = window.__rain;
    const cam = g.camera;
    const V = cam.position.constructor;
    const toNdc = (x, y, z) => {
      const v = new V(x, y, z);
      v.project(cam);
      return { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) };
    };
    const t = g.terrain;
    const cx = t ? t.originX + t.width * 0.5 : 0;
    const cz = t ? t.originZ + t.depth * 0.5 : 0;
    const spanMin = t ? Math.min(t.width, t.depth) : 20;
    const obj = (mesh) => {
      if (!mesh) return null;
      const p = mesh.position;
      const r = toNdc(p.x, p.y, p.z);
      return { ndc: r, pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], vis: mesh.visible, scale: [+mesh.scale.x.toFixed(1), +mesh.scale.y.toFixed(1)] };
    };
    return {
      cam: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)],
      center: toNdc(cx, 1.5, cz),
      farEdge: toNdc(cx, 1.5, cz - spanMin * 0.5),
      nearEdge: toNdc(cx, 1.5, cz + spanMin * 0.5),
      skyTop: toNdc(cx, 60, cz - 120),
      hillsBackdrop: obj(g.hillsBackdrop),
      hillsFar: obj(g.hillsFar),
      sunDisc: obj(g.sunDisc),
      sunHalo: obj(g.sunHalo),
      shaft0: obj(g.shafts?.[0]),
      softCloud0: obj(g.softClouds?.[0]?.mesh),
      puff0: obj(g.puffs?.[0]),
      rainbow: obj(g.rainbow),
      island0: obj(g.parallaxIslands?.[0]?.mesh),
      bird0: obj(g.birds?.[0]?.mesh),
      shafts: g.shafts?.map((s) => ({
        ndc: toNdc(s.position.x, s.position.y, s.position.z),
        vis: s.visible,
        op: +(s.material.opacity || 0).toFixed(2),
        scale: [+s.scale.x.toFixed(2), +s.scale.y.toFixed(2)],
        ro: s.renderOrder,
      })),
      dome: obj(g.skyDome),
      terrainSpan: t ? [t.width, t.depth] : null,
      frameDist: g.frameDist ? +g.frameDist(0).toFixed(1) : null,
    };
  });
  console.log(JSON.stringify(out, null, 1));
} finally {
  await browser.close();
}
