// Post-export UV fix:
// - Every billboard card must map the full texture 0..1.
// - The 3D trunk/limb/root tube gets a cylindrical bark projection.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'public/assets/vibrant_billboard_tree.glb';
const glb = readFileSync(path);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const binLen = glb.readUInt32LE(20 + jsonLen);
const bin = Buffer.from(glb.subarray(binStart, binStart + binLen));

function accessorInfo(index) {
  const acc = json.accessors[index];
  const bv = json.bufferViews[acc.bufferView];
  const at = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const compSize = acc.componentType === 5125 ? 4 : acc.componentType === 5123 ? 2 : acc.componentType === 5121 ? 1 : 4;
  const comps = acc.type === 'VEC3' ? 3 : acc.type === 'VEC2' ? 2 : 1;
  const stride = bv.byteStride || compSize * comps;
  return { acc, at, compSize, comps, stride };
}

function readFloats(index, comps) {
  const { acc, at, stride } = accessorInfo(index);
  const out = [];
  for (let i = 0; i < acc.count; i += 1) {
    const o = at + i * stride;
    const row = [];
    for (let c = 0; c < comps; c += 1) row.push(bin.readFloatLE(o + c * 4));
    out.push(row);
  }
  return out;
}

function readIndices(index) {
  const { acc, at, compSize, stride } = accessorInfo(index);
  const out = [];
  for (let i = 0; i < acc.count; i += 1) {
    const o = at + i * stride;
    if (compSize === 4) out.push(bin.readUInt32LE(o));
    else if (compSize === 2) out.push(bin.readUInt16LE(o));
    else out.push(bin.readUInt8(o));
  }
  return out;
}

const mesh = json.meshes[0];
const primitives = mesh.primitives;
let trunkPrim = primitives[0];
for (const prim of primitives) {
  const count = json.accessors[prim.indices].count;
  if (count > json.accessors[trunkPrim.indices].count) trunkPrim = prim;
}

const trunkIndices = readIndices(trunkPrim.indices);
const trunkSet = new Set(trunkIndices);
const trunkMinIndex = Math.min(...trunkIndices);
const trunkMaxIndex = Math.max(...trunkIndices);

const uvIndex = primitives[0].attributes.TEXCOORD_0;
const uvInfo = accessorInfo(uvIndex);
const uvAt = uvInfo.at;
const uvStride = uvInfo.stride;
const uvCount = uvInfo.acc.count;

// Every non-trunk vertex belongs to a leaf/fern/center card quad. The
// exporter may place added cards after the trunk's vertex block, so patch by
// exclusion rather than assuming leaves are all below the trunk's min index.
const corners = [[0, 1], [1, 1], [1, 0], [0, 0]];
let leafPatched = 0;
for (let i = 0; i < uvCount; i += 1) {
  if (trunkSet.has(i)) continue;
  const o = uvAt + i * uvStride;
  const [u, v] = corners[i % 4];
  bin.writeFloatLE(u, o);
  bin.writeFloatLE(v, o + 4);
  leafPatched += 1;
}

const positions = readFloats(trunkPrim.attributes.POSITION, 3);
let minY = Infinity;
let maxY = -Infinity;
for (const i of trunkSet) {
  minY = Math.min(minY, positions[i][1]);
  maxY = Math.max(maxY, positions[i][1]);
}
const height = Math.max(0.0001, maxY - minY);

let trunkUvMin = [Infinity, Infinity];
let trunkUvMax = [-Infinity, -Infinity];
for (const i of trunkSet) {
  const [x, y, z] = positions[i];
  // Single wrap; the clamped seam sits at the back. The bark texture is
  // phase-shifted so its center (the trunk front) is a lit ridge.
  let u = ((Math.atan2(z, x) + Math.PI) / (Math.PI * 2) - 0.25 + 1) % 1;
  const v = 1 - (y - minY) / height;
  // Roots are horizontal tubes; the trunk's cylindrical projection puts the
  // lit front band on all of their top faces. Shift their U to the dark side
  // so the splayed base reads as shaded bark instead of pale planks.
  if (y < 10 && Math.hypot(x, z) > 27.5) u = (u + 0.5) % 1;
  const o = uvAt + i * uvStride;
  bin.writeFloatLE(u, o);
  bin.writeFloatLE(v, o + 4);
  trunkUvMin = [Math.min(trunkUvMin[0], u), Math.min(trunkUvMin[1], v)];
  trunkUvMax = [Math.max(trunkUvMax[0], u), Math.max(trunkUvMax[1], v)];
}

let leafBad = 0;
for (let i = 0; i < uvCount; i += 1) {
  if (trunkSet.has(i)) continue;
  const o = uvAt + i * uvStride;
  const u = bin.readFloatLE(o);
  const v = bin.readFloatLE(o + 4);
  if ((u !== 0 && u !== 1) || (v !== 0 && v !== 1)) leafBad += 1;
}

bin.copy(glb, binStart);
writeFileSync(path, glb);

const samples = [];
for (let i = 0; i < 8; i += 1) {
  const o = uvAt + i * uvStride;
  samples.push([bin.readFloatLE(o), bin.readFloatLE(o + 4)]);
}

console.log(JSON.stringify({
  uvAccessor: uvIndex,
  uvCount,
  leafPatched,
  leafBad,
  trunkVertices: trunkSet.size,
  trunkMinIndex,
  trunkMaxIndex,
  trunkY: [Number(minY.toFixed(3)), Number(maxY.toFixed(3))],
  trunkUvMin: trunkUvMin.map(x => Number(x.toFixed(3))),
  trunkUvMax: trunkUvMax.map(x => Number(x.toFixed(3))),
  bytes: glb.length,
  samples,
}, null, 2));
