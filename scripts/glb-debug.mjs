// Debug: extract embedded GLB textures + inspect the rendered scene graph.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const glb = readFileSync('public/assets/vibrant_billboard_tree.glb');
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = glb.subarray(binStart);
mkdirSync('shots/glbtex', { recursive: true });
const images = (json.images || []).map((img, i) => {
  const bv = json.bufferViews[img.bufferView];
  const data = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  const file = `shots/glbtex/tex${i}.png`;
  writeFileSync(file, data);
  const w = data.readUInt32BE(16);
  const h = data.readUInt32BE(20);
  return { i, name: img.name, mime: img.mimeType, bytes: bv.byteLength, w, h, file };
});
console.log(JSON.stringify({ images, materials: json.materials, textures: json.textures }, null, 2));

const exe = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--no-sandbox'],
  defaultViewport: { width: 900, height: 1050, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', String(e)));
await page.goto('http://localhost:5173/glb-preview.html', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('window.__ready === true || window.__error', { timeout: 45000 });

const report = await page.evaluate(() => {
  const out = { meshes: [], bones: [], scene: [] };
  const scene = window.__scene;
  if (!scene) return { error: 'no __scene hook' };
  scene.traverse((o) => {
    out.scene.push({ name: o.name, type: o.type, visible: o.visible, pos: o.position.toArray().map((v) => +v.toFixed(2)) });
    if (o.isSkinnedMesh) {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const map = m && m.map;
      out.meshes.push({
        name: o.name,
        visible: o.visible,
        frustumCulled: o.frustumCulled,
        pos: o.position.toArray(),
        scale: o.scale.toArray(),
        matrixWorld: o.matrixWorld.elements.map((v) => +v.toFixed(2)),
        material: m ? { type: m.type, color: m.color && m.color.getHexString(), transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, depthWrite: m.depthWrite, map: map ? { uuid: map.uuid, w: map.image && map.image.width, h: map.image && map.image.height, colorSpace: map.colorSpace, flipY: map.flipY } : null } : null,
        skeleton: o.skeleton && { bones: o.skeleton.bones.map((b) => { const p = b.getWorldPosition(new (b.position.constructor)()); return { name: b.name, world: p.toArray().map((v) => +v.toFixed(2)) }; }) },
        boundingSphere: o.geometry.boundingSphere && { center: o.geometry.boundingSphere.center.toArray(), radius: o.geometry.boundingSphere.radius },
        posCount: o.geometry.attributes.position.count,
        weights: o.geometry.attributes.skinWeight && Array.from(o.geometry.attributes.skinWeight.array.slice(0, 8)),
        joints: o.geometry.attributes.skinIndex && Array.from(o.geometry.attributes.skinIndex.array.slice(0, 8)),
      });
    }
  });
  const T = window.__THREE;
  const box = new T.Box3().setFromObject(scene);
  out.box = { min: box.min.toArray(), max: box.max.toArray() };
  out.camera = { pos: window.__camera.position.toArray(), target: window.__camera.getWorldDirection(new T.Vector3()).toArray() };
  return out;
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
