import { readFileSync } from 'node:fs';

const glb = readFileSync('public/assets/vibrant_billboard_tree.glb');
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = glb.subarray(binStart);
const CT = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(i) {
  const a = json.accessors[i];
  const bv = json.bufferViews[a.bufferView];
  const [Arr, size] = CT[a.componentType];
  const n = NC[a.type];
  const stride = bv.byteStride || size * n;
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const out = [];
  for (let v = 0; v < a.count; v += 1) {
    const arr = new Arr(bin.buffer, bin.byteOffset + start + v * stride, n);
    out.push(Array.from(arr));
  }
  return out;
}

const report = json.meshes[0].primitives.map((p, i) => {
  const uv = readAccessor(p.attributes.TEXCOORD_0);
  const pos = readAccessor(p.attributes.POSITION);
  const w = readAccessor(p.attributes.WEIGHTS_0);
  const j = readAccessor(p.attributes.JOINTS_0);
  const uniq = (arr) => {
    const seen = new Map();
    for (const row of arr) {
      const k = row.join(',');
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  };
  return {
    prim: i,
    material: p.material,
    pos: uniq(pos),
    uv: uniq(uv),
    weights: uniq(w),
    joints: uniq(j),
  };
});
console.log(JSON.stringify(report, null, 2));
