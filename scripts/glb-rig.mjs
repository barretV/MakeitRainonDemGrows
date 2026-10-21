// Dev probe: dump the GLB node graph, skins and animation channels.
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'assets/vibrant_billboard_tree.glb';
const glb = readFileSync(path);
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = glb.subarray(binStart);

function accessorInfo(index) {
  const acc = json.accessors[index];
  const bv = json.bufferViews[acc.bufferView];
  const at = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const compSize = acc.componentType === 5125 ? 4 : acc.componentType === 5123 ? 2 : acc.componentType === 5121 ? 1 : 4;
  const comps = acc.type === 'VEC3' ? 3 : acc.type === 'VEC4' ? 4 : acc.type === 'SCALAR' ? 1 : 2;
  const stride = bv.byteStride || compSize * comps;
  return { acc, at, compSize, comps, stride };
}

function readVec(index) {
  const { at, compSize, comps, stride } = accessorInfo(index);
  const out = [];
  for (let i = 0; i < comps; i += 1) {
    const off = at + i * compSize;
    const v =
      compSize === 4 ? bin.readFloatLE(off)
      : compSize === 2 ? bin.readInt16LE(off)
      : bin.readUInt8(off);
    out.push(v);
  }
  return out;
}

console.log('=== nodes ===');
json.nodes.forEach((node, i) => {
  const t = node.translation ? node.translation.map((n) => +n.toFixed(3)) : null;
  const r = node.rotation ? node.rotation.map((n) => +n.toFixed(3)) : null;
  const s = node.scale ? node.scale.map((n) => +n.toFixed(3)) : null;
  const kids = (node.children || []).map((c) => json.nodes[c].name).join(',');
  console.log(
    `${i} ${node.name} mesh=${node.mesh ?? '-'} skin=${node.skin ?? '-'} T=${t ?? '-'} R=${r ?? '-'} S=${s ?? '-'} children=[${kids}]`,
  );
});

console.log('\n=== skins ===');
(json.skins || []).forEach((skin, i) => {
  console.log(`skin ${i} joints=${skin.joints.map((j) => json.nodes[j].name).join(', ')}`);
  skin.inverseBindMatrices !== undefined && console.log('  has inverse bind matrices');
});

console.log('\n=== animations ===');
(json.animations || []).forEach((anim, ai) => {
  console.log(`anim ${ai} ${anim.name} channels=${anim.channels.length}`);
  anim.channels.forEach((ch) => {
    const node = json.nodes[ch.target.node];
    const sampler = anim.samplers[ch.sampler];
    const interp = sampler.interpolation ?? 'LINEAR';
    let keys = '';
    if (ch.target.path === 'rotation') {
      const times = readVec(sampler.input);
      const vals = accessorInfo(sampler.output);
      const quats = [];
      for (let k = 0; k < Math.min(times.length, 6); k += 1) {
        const off = vals.at + k * vals.stride;
        const q = [bin.readFloatLE(off), bin.readFloatLE(off + 4), bin.readFloatLE(off + 8), bin.readFloatLE(off + 12)];
        // axis-angle magnitude of the quaternion deviation from identity
        const dot = Math.abs(q[0]) + Math.abs(q[1]) + Math.abs(q[2]);
        const ang = 2 * Math.acos(Math.min(1, Math.abs(q[3])));
        quats.push(`${times[k].toFixed(2)}s:${(ang * 57.3).toFixed(1)}deg`);
      }
      keys = quats.join(' ');
    } else {
      const times = readVec(sampler.input);
      keys = `${times.length} keys`;
    }
    console.log(`  ${node.name}.${ch.target.path} interp=${interp} ${keys}`);
  });
});
