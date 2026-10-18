import * as THREE from 'three';
import { TILE, gridOf, tileSpec } from './balance';

/** Two mask cells per voxel column on every flat world (mask cells are 0.32 world units). */
export const VOX = 0.64;
const STEP = 0.32;
const FLOOR = -4.2;

interface Palette {
  deadA: string;
  deadB: string;
  rockA: string;
  rockB: string;
  liveA: string;
  liveB: string;
  dirtA: string;
  dirtB: string;
}

const PALETTES: Palette[] = [
  { deadA: '#9a938a', deadB: '#7a736c', rockA: '#8f877e', rockB: '#5c564f', liveA: '#7dce4a', liveB: '#5cb83a', dirtA: '#8a5a32', dirtB: '#5a3a22' },
  { deadA: '#e4edf7', deadB: '#c6d6ea', rockA: '#b9cade', rockB: '#8ea5c0', liveA: '#9fe3a4', liveB: '#74cc8a', dirtA: '#8d7a68', dirtB: '#6a594a' },
  { deadA: '#ecd6a6', deadB: '#d9be8a', rockA: '#d9b27e', rockB: '#ad8256', liveA: '#a8dc62', liveB: '#82c44c', dirtA: '#bc8a5c', dirtB: '#90643e' },
  { deadA: '#76824e', deadB: '#5e683e', rockA: '#6a5e4c', rockB: '#463d32', liveA: '#8cf0b4', liveB: '#5edab6', dirtA: '#7a5aa0', dirtB: '#56407a' },
];

function hash2(x: number, z: number, seed: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function smooth(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const fx = x - xi;
  const fz = z - zi;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi, seed);
  const b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed);
  const d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number, seed: number): number {
  return smooth(x, z, seed) * 0.6 + smooth(x * 2.1, z * 2.1, seed + 3) * 0.28 + smooth(x * 4.3, z * 4.3, seed + 7) * 0.12;
}

function linear(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/** A stepped height field of voxel columns. The board covers [-TILE/2, cols*TILE - TILE/2] on X and Z. */
export class Terrain {
  readonly cols: number;
  readonly rows: number;
  readonly originX = -TILE / 2;
  readonly originZ = -TILE / 2;
  readonly width: number;
  readonly depth: number;
  readonly heights: Float32Array;

  constructor(readonly world: number) {
    const grid = gridOf(world);
    this.width = grid.cols * TILE;
    this.depth = grid.rows * TILE;
    this.cols = Math.round(this.width / VOX);
    this.rows = Math.round(this.depth / VOX);
    this.heights = new Float32Array(this.cols * this.rows);
    const seed = world * 13 + 5;
    const tileCount = grid.cols * grid.rows;
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        const x = this.originX + (c + 0.5) * VOX;
        const z = this.originZ + (r + 0.5) * VOX;
        const n = fbm(x * 0.07, z * 0.07, seed);
        const ridge = Math.abs(fbm(x * 0.04 + 9, z * 0.04 - 4, seed + 1) - 0.5) * 2;
        let h = 0.95 + Math.pow(n, 1.22) * 7.4 + (1 - ridge) * 2.35;
        const nz = (z - this.originZ) / this.depth;
        if (nz > 0.74) h = 0.42 + n * 0.62;
        const tc = Math.max(0, Math.min(grid.cols - 1, Math.floor((x - this.originX) / TILE)));
        const tr = Math.max(0, Math.min(grid.rows - 1, Math.floor((z - this.originZ) / TILE)));
        const spec = tileSpec(world, tr * grid.cols + tc, tileCount);
        if (spec.kind === 'pond') {
          const cx = this.originX + (tc + 0.5) * TILE;
          const cz = this.originZ + (tr + 0.5) * TILE;
          const d = Math.hypot(x - cx, z - cz) / (TILE * 0.5);
          if (d < 1) h = h * Math.min(1, d * d) + 0.18 * (1 - Math.min(1, d * d));
        }
        const edge = Math.min(c, r, this.cols - 1 - c, this.rows - 1 - r);
        if (edge === 0) h -= 0.45;
        else if (edge === 1) h -= 0.12;
        this.heights[r * this.cols + c] = Math.max(0.2, Math.round(h / STEP) * STEP);
      }
    }
  }

  heightAt(x: number, z: number): number {
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.originX) / VOX)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor((z - this.originZ) / VOX)));
    return this.heights[r * this.cols + c] ?? 1;
  }

  /** Bilinear blend between column tops so the cloud does not snap on voxel steps. */
  heightAtSmooth(x: number, z: number): number {
    const fx = (x - this.originX) / VOX - 0.5;
    const fz = (z - this.originZ) / VOX - 0.5;
    const c0 = Math.floor(fx);
    const r0 = Math.floor(fz);
    const tx = fx - c0;
    const tz = fz - r0;
    const sample = (c: number, r: number): number => {
      const cc = Math.max(0, Math.min(this.cols - 1, c));
      const rr = Math.max(0, Math.min(this.rows - 1, r));
      return this.heights[rr * this.cols + cc] ?? 1;
    };
    const a = sample(c0, r0);
    const b = sample(c0 + 1, r0);
    const c = sample(c0, r0 + 1);
    const d = sample(c0 + 1, r0 + 1);
    const top = a + (b - a) * tx;
    const bot = c + (d - c) * tx;
    return top + (bot - top) * tz;
  }

  /** One instanced draw for every column. Tops read the restore mask so green creeps in pixel by pixel. */
  buildMesh(mask: THREE.Texture, maskSize: { cols: number; rows: number }, time: { value: number }, fog: THREE.Fog): THREE.InstancedMesh {
    const pal = PALETTES[this.world] ?? PALETTES[0]!;
    const geo = new THREE.BoxGeometry(VOX, 1, VOX);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMask: { value: mask },
        uMaskSize: { value: new THREE.Vector2(maskSize.cols, maskSize.rows) },
        uBoard: { value: new THREE.Vector4(this.originX, this.originZ, this.width, this.depth) },
        uTime: time,
        uDeadA: { value: linear(pal.deadA) },
        uDeadB: { value: linear(pal.deadB) },
        uRockA: { value: linear(pal.rockA) },
        uRockB: { value: linear(pal.rockB) },
        uLiveA: { value: linear(pal.liveA) },
        uLiveB: { value: linear(pal.liveB) },
        uDirtA: { value: linear(pal.dirtA) },
        uDirtB: { value: linear(pal.dirtB) },
        uFog: { value: fog.color.clone() },
        uFogRange: { value: new THREE.Vector2(Math.max(55, fog.far * 0.9), Math.max(160, fog.far * 2.8)) },
      },
      vertexShader: VOXEL_VERT,
      fragmentShader: VOXEL_FRAG,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, this.cols * this.rows);
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    let i = 0;
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        const top = this.heights[r * this.cols + c] ?? 1;
        const edgeDist = Math.min(c, r, this.cols - 1 - c, this.rows - 1 - r);
        const jag =
          edgeDist <= 1
            ? FLOOR + hash2(c, r, 2) * 2.1
            : Math.min(top - 0.3, this.neighborFloor(c, r));
        const bottom = Math.min(top - 0.2, jag);
        pos.set(this.originX + (c + 0.5) * VOX, (top + bottom) / 2, this.originZ + (r + 0.5) * VOX);
        scl.set(1, top - bottom, 1);
        m.compose(pos, quat, scl);
        mesh.setMatrixAt(i, m);
        i += 1;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Columns only need to reach down to their lowest neighbour, which keeps interior overdraw low. */
  private neighborFloor(c: number, r: number): number {
    let low = Infinity;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const h = this.heights[(r + dr) * this.cols + (c + dc)];
      if (h !== undefined) low = Math.min(low, h);
    }
    return low - 0.05;
  }

  /** Little sprites scattered on the column tops: twigs and pebbles while dead, flowers and tufts once their pixel is green. */
  buildFlora(atlas: THREE.Texture, mask: THREE.Texture, maskSize: { cols: number; rows: number }, time: { value: number }, fog: THREE.Fog): THREE.InstancedMesh {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const spots: number[] = [];
    const frames: number[] = [];
    const seed = this.world * 7 + 1;
    for (let r = 1; r < this.rows - 1; r += 1) {
      for (let c = 1; c < this.cols - 1; c += 1) {
        for (let k = 0; k < 2; k += 1) {
          const roll = hash2(c + k * 31, r, seed);
          if (roll > 0.42) continue;
          const x = this.originX + (c + 0.15 + hash2(c, r + k * 17, seed + 1) * 0.7) * VOX;
          const z = this.originZ + (r + 0.15 + hash2(c + k * 5, r, seed + 2) * 0.7) * VOX;
          const y = this.heightAt(x, z);
          const deadFrame = roll < 0.12 ? Math.floor(hash2(c, r, seed + 3) * 3) : 3;
          const liveFrame = 4 + Math.floor(hash2(c, r + k, seed + 4) * 4);
          const size = 0.34 + hash2(c, r, seed + 5) * 0.22;
          spots.push(x, y, z, size);
          frames.push(deadFrame, liveFrame);
        }
      }
    }
    const count = Math.max(1, spots.length / 4);
    if (spots.length === 0) spots.push(0, 1, 0, 0.01);
    geo.setAttribute('aSpot', new THREE.InstancedBufferAttribute(new Float32Array(spots), 4));
    geo.setAttribute('aFrame', new THREE.InstancedBufferAttribute(new Float32Array(frames), 2));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: atlas },
        uMask: { value: mask },
        uMaskSize: { value: new THREE.Vector2(maskSize.cols, maskSize.rows) },
        uBoard: { value: new THREE.Vector4(this.originX, this.originZ, this.width, this.depth) },
        uTime: time,
        uFog: { value: fog.color.clone() },
        uFogRange: { value: new THREE.Vector2(Math.max(55, fog.far * 0.9), Math.max(160, fog.far * 2.8)) },
      },
      vertexShader: FLORA_VERT,
      fragmentShader: FLORA_FRAG,
      transparent: false,
      alphaTest: 0.5,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    return mesh;
  }
}

const VOXEL_VERT = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vTop;
  varying float vDepth;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vTop = (modelMatrix * instanceMatrix * vec4(0.0, 0.5, 0.0, 1.0)).y;
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const VOXEL_FRAG = /* glsl */ `
  uniform sampler2D uMask;
  uniform vec2 uMaskSize;
  uniform vec4 uBoard;
  uniform float uTime;
  uniform vec3 uDeadA;
  uniform vec3 uDeadB;
  uniform vec3 uRockA;
  uniform vec3 uRockB;
  uniform vec3 uLiveA;
  uniform vec3 uLiveB;
  uniform vec3 uDirtA;
  uniform vec3 uDirtB;
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vTop;
  varying float vDepth;

  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  vec4 maskAt(vec2 xz) {
    vec2 uv = clamp((xz - uBoard.xy) / uBoard.zw, 0.0, 0.9999);
    vec2 cell = floor(uv * uMaskSize);
    return texture2D(uMask, (cell + 0.5) / uMaskSize);
  }

  void main() {
    vec3 col;
    if (vN.y > 0.5) {
      vec4 m = maskAt(vWorld.xz);
      float wet = m.r;
      float rip = m.g;
      float soak = smoothstep(0.03, 0.2, wet);
      float moss = smoothstep(0.18, 0.42, wet);
      float grass = smoothstep(0.38, 0.65, wet);
      float bloom = smoothstep(0.58, 0.9, wet);
      float grown = smoothstep(0.82, 0.98, wet);
      vec2 slab = vWorld.xz * 1.7;
      vec2 cell = floor(slab);
      vec2 f = fract(slab);
      float n = h21(cell);
      float n2 = h21(cell + 19.0);
      vec3 dead = mix(uDeadA, uDeadB, step(0.5, n));
      dead *= 0.92 + 0.1 * h21(cell + 4.0);
      float crack = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      dead = mix(dead * 0.52, dead, smoothstep(0.0, 0.07, crack));
      if (n2 > 0.93) dead *= 0.78;
      vec3 mud = mix(uDirtA, uDirtB, step(0.45, n));
      vec3 wetCol = mix(dead * vec3(0.42, 0.58, 0.95), vec3(0.28, 0.52, 0.82), soak);
      vec3 damp = mix(dead, wetCol, soak);
      damp = mix(damp, mud * vec3(0.9, 1.05, 0.82), moss * 0.85);
      float glint = step(0.965, fract(n * 7.0 + uTime * 0.45)) * wet * (1.0 - grass);
      damp += vec3(0.55, 0.85, 1.0) * glint;
      vec3 live = mix(uLiveA, uLiveB, step(0.55, n)) * (0.92 + 0.12 * h21(cell + 8.0));
      float fl = h21(cell + 3.0);
      vec3 patch = mix(live * 0.55, live, grass);
      if (bloom > 0.35 && fl > 0.94) {
        patch = fl > 0.985 ? vec3(1.0, 0.92, 0.96) : fl > 0.968 ? vec3(1.0, 0.42, 0.58) : vec3(0.48, 0.78, 1.0);
      } else if (n2 > 0.9 && grass > 0.4) {
        patch *= 1.12;
      }
      col = mix(damp, patch, grass * 0.92 + bloom * 0.25);
      col = mix(col, live, grown);
      vec2 local = fract(vWorld.xz * 3.125) - 0.5;
      float ring = smoothstep(0.22, 0.0, abs(length(local) * 2.0 - (1.0 - rip) * 1.35)) * rip;
      col += vec3(1.0, 0.95, 0.65) * ring * (0.45 + soak * 0.35);
      col += vec3(0.75, 1.0, 0.85) * bloom * 0.08 * sin(uTime * 3.2 + vWorld.x * 2.0);
      vec2 vf = fract((vWorld.xz - uBoard.xy) / ${VOX.toFixed(2)});
      float seam = step(vf.x, 0.04) + step(vf.y, 0.04);
      col *= 1.0 - min(seam, 1.0) * 0.06;
      col *= 0.78 + clamp(vTop, 0.0, 4.5) * 0.07;
    } else {
      float below = vTop - vWorld.y;
      vec4 m = maskAt(vWorld.xz - vN.xz * 0.05);
      float grown = step(0.999, m.r);
      float along = vWorld.x * abs(vN.z) + vWorld.z * abs(vN.x);
      vec2 fine = floor(vec2(along, vWorld.y) * 12.5);
      float n = h21(fine);
      float band = step(0.5, fract(vWorld.y * 1.4 + h21(vec2(floor(along * 1.5), 3.0)) * 0.35));
      vec3 rock = mix(uRockA, uRockB, band) * (0.9 + 0.18 * n);
      vec3 dirt = mix(uDirtA, uDirtB, band) * (0.88 + 0.2 * n);
      if (n > 0.94) dirt = mix(dirt, uRockA, 0.7);
      vec3 body = mix(rock, dirt, grown);
      body = mix(body, rock * 0.72, smoothstep(-0.5, -2.5, vWorld.y));
      float lipDepth = 0.1 + 0.08 * h21(vec2(floor(along * 12.5), 1.0)) + grown * 0.06;
      vec3 lipCol = mix(uDeadB * 0.95, uLiveB * 0.92, grown);
      col = mix(body, lipCol, step(below, lipDepth));
      col *= abs(vN.z) > 0.5 ? (vN.z > 0.0 ? 0.9 : 0.72) : (vN.x < 0.0 ? 0.78 : 0.72);
      col *= mix(0.82, 1.0, smoothstep(1.2, 0.0, below));
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

const FLORA_VERT = /* glsl */ `
  attribute vec4 aSpot;
  attribute vec2 aFrame;
  uniform sampler2D uMask;
  uniform vec2 uMaskSize;
  uniform vec4 uBoard;
  uniform float uTime;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec2 muv = clamp((aSpot.xz - uBoard.xy) / uBoard.zw, 0.0, 0.9999);
    vec4 m = texture2D(uMask, (floor(muv * uMaskSize) + 0.5) / uMaskSize);
    float wet = m.r;
    float grown = smoothstep(0.32, 0.88, wet);
    float frame = mix(aFrame.x, aFrame.y, grown);
    float hidden = step(2.5, frame) * step(frame, 3.5);
    float pop = 1.0 + m.g * 0.9;
    float size = aSpot.w * pop * (1.0 - hidden) * mix(0.15, 1.0, grown);
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    float sway = sin(uTime * 1.8 + aSpot.x * 3.0 + aSpot.z * 2.0) * 0.06 * grown * position.y;
    vec3 wp = aSpot.xyz + right * (position.x + sway) * size + vec3(0.0, position.y * size, 0.0);
    vUv = vec2((frame + position.x + 0.5) / 8.0, position.y);
    vec4 mv = viewMatrix * vec4(wp, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FLORA_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec4 c = texture2D(uAtlas, vUv);
    if (c.a < 0.5) discard;
    gl_FragColor = vec4(c.rgb, 1.0);
  }
`;
