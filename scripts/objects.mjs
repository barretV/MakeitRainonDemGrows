// Dev probe: list visible scene meshes whose centre projects inside a screen box.
// Usage: node scripts/objects.mjs [port] [world] [soak] [x0] [x1] [y0] [y1]
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const port = Number(process.argv[2] ?? 5173);
const world = Number(process.argv[3] ?? 0);
const soak = Number(process.argv[4] ?? 0.15);
const x0 = Number(process.argv[5] ?? -0.2);
const x1 = Number(process.argv[6] ?? 0.2);
const y0 = Number(process.argv[7] ?? 0.3);
const y1 = Number(process.argv[8] ?? 0.7);

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
  const out = await page.evaluate(({ x0, x1, y0, y1 }) => {
    const g = window.__rain;
    const cam = g.camera;
    const V = cam.position.constructor;
    const rows = [];
    g.scene.traverse((o) => {
      if (!o.isMesh && !o.isSprite) return;
      let p = o;
      let vis = true;
      while (p) {
        if (!p.visible) {
          vis = false;
          break;
        }
        p = p.parent;
      }
      if (!vis) return;
      const wp = o.getWorldPosition(new V());
      const ndc = wp.clone().project(cam);
      if (ndc.x < x0 || ndc.x > x1 || ndc.y < y0 || ndc.y > y1) return;
      const geo = o.geometry;
      const params =
        geo && geo.parameters
          ? Object.entries(geo.parameters)
              .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`)
              .join(',')
          : '';
      const map = o.material && o.material.map;
      const img = map && map.image ? `${map.image.width}x${map.image.height}` : 'none';
      rows.push({
        t: o.type,
        ndc: [+ndc.x.toFixed(2), +ndc.y.toFixed(2)],
        pos: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)],
        sc: [+o.scale.x.toFixed(2), +o.scale.y.toFixed(2)],
        geo: params,
        tex: img,
        ro: o.renderOrder,
        par: o.parent ? o.parent.type : '',
      });
    });
    return { count: rows.length, rows };
  }, { x0, x1, y0, y1 });
  console.log(`count ${out.count}`);
  for (const r of out.rows) {
    console.log(
      `${r.t} ndc=${r.ndc.join(',')} pos=${r.pos.join(',')} sc=${r.sc.join(',')} geo[${r.geo}] tex=${r.tex} ro=${r.ro} par=${r.par}`,
    );
  }
  const extra = await page.evaluate(() => {
    const g = window.__rain;
    const cam = g.camera;
    const V = cam.position.constructor;
    const out = [];
    out.push(
      `cam pos=${cam.position.x.toFixed(2)},${cam.position.y.toFixed(2)},${cam.position.z.toFixed(2)} zoom=${(g.camZoom ?? 0).toFixed(2)} yaw=${(g.camYaw ?? 0).toFixed(2)} cloud=${(g.cloudX ?? 0).toFixed(2)},${(g.cloudZ ?? 0).toFixed(2)} hoverY=${(g.hoverY ?? 0).toFixed(2)} camGroundY=${(g.camGroundY ?? 0).toFixed(2)} intro=${g.intro ?? '-'}`,
    );
    const st = g.state;
    if (st && st.world === 4) {
      const mask = g.maskTex;
      const data = mask?.image?.data;
      const cols = mask?.image?.width ?? 0;
      const rows = mask?.image?.height ?? 0;
      out.push(`mask ${cols}x${rows} bytes=${data ? data.length : -1}`);
      if (data) {
        const sample = (c, r) => {
          const i = ((r * cols + c) * 4);
          return `(${c},${r})=r${data[i]}/g${data[i + 1]}/b${data[i + 2]}`;
        };
        const pts = [
          [400, 6],
          [400, 30],
          [400, 60],
          [400, 90],
          [400, 114],
          [100, 60],
          [700, 60],
          [40, 30],
          [760, 90],
        ];
        for (const [c, r] of pts) out.push(sample(c, r));
        let lo = 1;
        let hi = 0;
        for (let i = 0; i < cols * rows; i += 1) {
          const v = (st.progress[i] ?? 0) / Math.max(1, 3072281 / (cols * rows));
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        out.push(`progress min=${lo.toFixed(3)} max=${hi.toFixed(3)}`);
      }
    }
    (g.views ?? []).forEach((v, i) => {
      if (!v.pond) return;
      const grp = v.pond.parent;
      const ndc = grp ? grp.getWorldPosition(new V()).project(cam) : null;
      out.push(
        `pond tile=${i} x=${v.x.toFixed(2)} y=${v.y.toFixed(2)} z=${v.z.toFixed(2)} fill=${g.state.pondFill(i).toFixed(2)} ndc=${ndc ? ndc.x.toFixed(2) + ',' + ndc.y.toFixed(2) : '-'} water=${v.pondWater ? `${v.pondWater.visible}/${v.pondWater.scale.x.toFixed(2)}` : '-'} lily=${v.pondLily ? `${v.pondLily[0].visible},${v.pondLily[1].visible}` : '-'} frog=${v.pondFrog ? v.pondFrog.visible : '-'} koi=${v.koi ? v.koi.visible : '-'} bar=${v.bar ? v.bar.visible : '-'}`,
      );
    });
    for (const a of g.animals ?? []) {
      const ndc = a.mesh.position.clone().project(cam);
      out.push(
        `animal ndc=${ndc.x.toFixed(2)},${ndc.y.toFixed(2)} pos=${a.mesh.position.x.toFixed(2)},${a.mesh.position.y.toFixed(2)},${a.mesh.position.z.toFixed(2)} tile=${a.tile} vis=${a.mesh.visible}`,
      );
    }
    return out;
  });
  for (const line of extra) console.log(line);
} finally {
  await browser.close();
}
