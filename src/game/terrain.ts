import * as THREE from 'three';
import { GLOBE_WORLD, TILE, gridOf, islandRadius, islandShore, tileSpec, worldDef } from './balance';
import { normalOf } from './normals';

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
  { deadA: '#6a4556', deadB: '#3a2434', rockA: '#4a3542', rockB: '#2a1c28', liveA: '#7dce4a', liveB: '#5cb83a', dirtA: '#6a4030', dirtB: '#3a2418' },
  { deadA: '#f7fbff', deadB: '#d5e6f6', rockA: '#6e96c8', rockB: '#35598f', liveA: '#b7f0c8', liveB: '#6ed4a0', dirtA: '#7f6a9a', dirtB: '#4d6f96' },
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
  /** Negative = inside the flying island; positive = open sky. */
  readonly shore: Float32Array;
  readonly spherical: boolean;

  constructor(readonly world: number) {
    this.spherical = world === GLOBE_WORLD;
    const grid = gridOf(world);
    this.width = grid.cols * TILE;
    this.depth = grid.rows * TILE;
    this.cols = Math.round(this.width / VOX);
    this.rows = Math.round(this.depth / VOX);
    this.heights = new Float32Array(this.cols * this.rows);
    this.shore = new Float32Array(this.cols * this.rows);
    const seed = world * 13 + 5;
    const tileCount = grid.cols * grid.rows;
    const centerX = this.originX + this.width * 0.5;
    const centerZ = this.originZ + this.depth * 0.5;
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        const x = this.originX + (c + 0.5) * VOX;
        const z = this.originZ + (r + 0.5) * VOX;
        const idx = r * this.cols + c;
        let shore = 1;
        if (!this.spherical) {
          const radius = islandRadius(world, this.width, this.depth);
          const dx = x - centerX;
          const dz = z - centerZ;
          // Every island has its own silhouette.
          const warble = (fbm(x * 0.16, z * 0.16, seed + 20) - 0.5) * 0.16;
          shore = islandShore(world, dx, dz, radius) + warble;
        } else {
          shore = -0.5;
        }
        this.shore[idx] = shore;
        const n = fbm(x * 0.07, z * 0.07, seed);
        const ridge = Math.abs(fbm(x * 0.04 + 9, z * 0.04 - 4, seed + 1) - 0.5) * 2;
        let h = 1.1 + Math.pow(n, 1.15) * 4.6 + (1 - ridge) * 1.4;
        const tc = Math.max(0, Math.min(grid.cols - 1, Math.floor((x - this.originX) / TILE)));
        const tr = Math.max(0, Math.min(grid.rows - 1, Math.floor((z - this.originZ) / TILE)));
        const spec = tileSpec(world, tr * grid.cols + tc, tileCount);
        if (spec.kind === 'pond') {
          const cx = this.originX + (tc + 0.5) * TILE;
          const cz = this.originZ + (tr + 0.5) * TILE;
          const d = Math.hypot(x - cx, z - cz) / (TILE * 0.5);
          const dip = (1 - Math.min(1, d * d)) * 0.6;
          h = Math.max(0.25, h - dip);
        }
        if (!this.spherical) {
          if (shore > 0.14) {
            h = 0;
          } else if (shore > -0.28) {
            h *= 1 - (shore + 0.28) / 0.42;
          }
        }
        this.heights[idx] = Math.max(0, Math.round(h / STEP) * STEP);
      }
    }
  }

  shoreAt(x: number, z: number): number {
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.originX) / VOX)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor((z - this.originZ) / VOX)));
    return this.shore[r * this.cols + c] ?? 1;
  }

  private lonLatFromColumn(c: number, r: number): { lon: number; lat: number } {
    const lon = ((c + 0.5) / this.cols) * Math.PI * 2;
    const lat = ((r + 0.5) / Math.max(1, this.rows - 1) - 0.5) * Math.PI * 0.82;
    return { lon, lat };
  }

  private spherePoint(lon: number, lat: number, radius: number): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(lat) * Math.sin(lon) * radius, Math.sin(lat) * radius, Math.cos(lat) * Math.cos(lon) * radius);
  }

  private isIcebergDrip(c: number, r: number, shore: number): boolean {
    if (shore <= 0.06 || shore >= 0.34) return false;
    return hash2(c, r, this.world * 3 + 9) > 0.52;
  }

  /**
   * A downhill path from a point to the island's edge: the way water would
   * run. Steps to the lowest neighbour, with a nudge toward the given
   * direction so it does not stall in a hollow.
   */
  downhillPath(x: number, z: number, dirX: number, dirZ: number, maxSteps = 300): { x: number; y: number; z: number }[] {
    const path: { x: number; y: number; z: number }[] = [];
    const len = Math.hypot(dirX, dirZ) || 1;
    const tx = dirX / len;
    const tz = dirZ / len;
    let cx = x;
    let cz = z;
    for (let step = 0; step < maxSteps; step += 1) {
      const y = this.heightAt(cx, cz);
      path.push({ x: cx, y, z: cz });
      if (this.shoreAt(cx, cz) > 0.01) break;
      let bestX = cx;
      let bestZ = cz;
      let bestY = y;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dz === 0) continue;
          const nx = cx + dx * VOX;
          const nz = cz + dz * VOX;
          const ny = this.heightAt(nx, nz);
          const score = ny - (nx - cx) * tx * 0.9 - (nz - cz) * tz * 0.9;
          if (score < bestScore) {
            bestScore = score;
            bestX = nx;
            bestZ = nz;
            bestY = ny;
          }
        }
      }
      if (bestX === cx && bestZ === cz) break;
      cx = bestX;
      cz = bestZ;
      void bestY;
    }
    return path;
  }

  heightAt(x: number, z: number): number {
    const c = Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.originX) / VOX)));
    const r = Math.max(0, Math.min(this.rows - 1, Math.floor((z - this.originZ) / VOX)));
    return this.heights[r * this.cols + c] ?? 1;
  }

  /**
   * Tallest column inside a circle. Overlays (the rain ring) sit on this so a
   * flat marker clears the whole island instead of being sliced by voxel steps.
   */
  maxHeightNear(x: number, z: number, radius: number): number {
    if (this.spherical) return 0;
    const c0 = Math.max(0, Math.min(this.cols - 1, Math.floor((x - radius - this.originX) / VOX)));
    const c1 = Math.max(0, Math.min(this.cols - 1, Math.ceil((x + radius - this.originX) / VOX)));
    const r0 = Math.max(0, Math.min(this.rows - 1, Math.floor((z - radius - this.originZ) / VOX)));
    const r1 = Math.max(0, Math.min(this.rows - 1, Math.ceil((z + radius - this.originZ) / VOX)));
    let max = 0;
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const h = this.heights[r * this.cols + c] ?? 0;
        if (h > max) max = h;
      }
    }
    return max;
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
  buildMesh(
    mask: THREE.Texture,
    pulse: THREE.Texture,
    maskSize: { cols: number; rows: number },
    time: { value: number },
    fog: THREE.Fog,
    sunDir: THREE.Vector3,
    sunColor: THREE.Color,
    cloud: THREE.Vector3,
    rain: { value: number },
  ): THREE.InstancedMesh {
    const pal = PALETTES[this.world] ?? PALETTES[0]!;
    const geo = new THREE.BoxGeometry(VOX, 1, VOX);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMask: { value: mask },
        uPulse: { value: pulse },
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
        uFogRange: { value: new THREE.Vector2(fog.near, fog.far) },
        uGlobe: { value: this.spherical ? 1 : 0 },
        uSunDir: { value: sunDir },
        uSunColor: { value: sunColor },
        uDusk: { value: linear(worldDef(this.world).skyBot) },
        uCloud: { value: cloud },
        uRain: rain,
        uSeek: { value: 0 },
      },
      vertexShader: VOXEL_VERT,
      fragmentShader: VOXEL_FRAG,
    });
    const matrices: THREE.Matrix4[] = [];
    const cells: number[] = [];
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3();
    for (let r = 0; r < this.rows; r += 1) {
      for (let c = 0; c < this.cols; c += 1) {
        const idx = r * this.cols + c;
        const shore = this.shore[idx] ?? 1;
        const topFlat = this.heights[idx] ?? 0;
        const drip = !this.spherical && this.isIcebergDrip(c, r, shore);
        if (!this.spherical && shore > 0.14 && !drip) continue;
        let top = topFlat;
        let bottom: number;
        if (drip) {
          const hang = 2.2 + hash2(c, r, 4) * 5.5;
          top = -0.35 - hash2(c, r, 5) * 1.2;
          bottom = top - hang;
        } else if (top < 0.12) {
          continue;
        } else {
          const edgeDist = Math.min(c, r, this.cols - 1 - c, this.rows - 1 - r);
          const jag =
            edgeDist <= 1
              ? FLOOR + hash2(c, r, 2) * 2.4
              : Math.min(top - 0.3, this.neighborFloor(c, r));
          bottom = Math.min(top - 0.2, jag);
          if (!this.spherical && shore > -0.32) {
            const hang = 3.5 + hash2(c, r, 6) * 7.5;
            bottom = Math.min(bottom, top - hang);
          }
        }
        const height = Math.max(0.18, top - bottom);
        if (this.spherical) {
          const { lon, lat } = this.lonLatFromColumn(c, r);
          normal.copy(this.spherePoint(lon, lat, 1)).normalize();
          // gentle relief: from space the planet should read smooth, not voxel-stepped
          const surfaceR = 6.38 + top * 0.035;
          const coreR = 6.38 + bottom * 0.035;
          const midR = (surfaceR + coreR) / 2;
          pos.copy(this.spherePoint(lon, lat, midR));
          quat.setFromUnitVectors(up, normal);
          scl.set(1, Math.max(0.2, surfaceR - coreR), 1);
        } else {
          pos.set(this.originX + (c + 0.5) * VOX, (top + bottom) / 2, this.originZ + (r + 0.5) * VOX);
          quat.identity();
          scl.set(1, height, 1);
        }
        m.compose(pos, quat, scl);
        matrices.push(m.clone());
        cells.push((c + 0.5) / maskSize.cols, (r + 0.5) / maskSize.rows);
      }
    }
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, matrices.length));
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(cells.length ? cells : [0, 0]), 2));
    matrices.forEach((mat4, i) => mesh.setMatrixAt(i, mat4));
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
  buildFlora(
    atlas: THREE.Texture,
    mask: THREE.Texture,
    pulse: THREE.Texture,
    maskSize: { cols: number; rows: number },
    time: { value: number },
    fog: THREE.Fog,
    sunDir: THREE.Vector3,
    sunColor: THREE.Color,
  ): THREE.InstancedMesh {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const spots: number[] = [];
    const frames: number[] = [];
    const seed = this.world * 7 + 1;
    for (let r = 1; r < this.rows - 1; r += 1) {
      for (let c = 1; c < this.cols - 1; c += 1) {
        if ((this.shore[r * this.cols + c] ?? 1) > 0.02) continue;
        for (let k = 0; k < 2; k += 1) {
          const roll = hash2(c + k * 31, r, seed);
          if (roll > 0.42) continue;
          const x = this.originX + (c + 0.15 + hash2(c, r + k * 17, seed + 1) * 0.7) * VOX;
          const z = this.originZ + (r + 0.15 + hash2(c + k * 5, r, seed + 2) * 0.7) * VOX;
          if (this.shoreAt(x, z) > 0.02) continue;
          const y = this.heightAt(x, z);
          const deadFrame = roll < 0.12 ? Math.floor(hash2(c, r, seed + 3) * 3) : 3;
          const liveFrame = 4 + Math.floor(hash2(c, r + k, seed + 4) * 12);
          const size = 0.38 + hash2(c, r, seed + 5) * 0.26;
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
        uPulse: { value: pulse },
        uMaskSize: { value: new THREE.Vector2(maskSize.cols, maskSize.rows) },
        uBoard: { value: new THREE.Vector4(this.originX, this.originZ, this.width, this.depth) },
        uTime: time,
        uFog: { value: fog.color.clone() },
        uFogRange: { value: new THREE.Vector2(fog.near, fog.far) },
        uNormal: { value: normalOf(atlas) },
        uSunDir: { value: sunDir },
        uSunColor: { value: sunColor },
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
  attribute vec2 aCell;
  uniform vec2 uMaskSize;
  uniform vec4 uBoard;
  uniform float uGlobe;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vUp;
  varying float vTop;
  varying float vDepth;
  varying vec2 vCell;
  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    // how much this face points along the column's own up axis: "top" on flat
    // worlds, "outward" on the globe (where the up axis is the sphere normal)
    vec3 instUp = normalize(mat3(instanceMatrix) * vec3(0.0, 1.0, 0.0));
    vUp = dot(vN, instUp);
    vTop = (modelMatrix * instanceMatrix * vec4(0.0, 0.5, 0.0, 1.0)).y;
    // mask lookup in cell units: lon/lat for the globe, board space for flat worlds
    vec2 uv = clamp((wp.xz - uBoard.xy) / uBoard.zw, 0.0, 0.9999);
    vCell = mix(uv, aCell, step(0.5, uGlobe)) * uMaskSize;
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const VOXEL_FRAG = /* glsl */ `
  uniform sampler2D uMask;
  uniform sampler2D uPulse;
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
  uniform float uGlobe;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uDusk;
  uniform vec3 uCloud;
  uniform float uRain;
  uniform float uSeek;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vUp;
  varying float vTop;
  varying float vDepth;
  varying vec2 vCell;

  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // flat worlds look the cell up per fragment (columns straddle cell borders);
  // the globe uses the interpolated lon/lat cell coming from the vertex shader
  vec2 maskCell() {
    vec2 uv = clamp((vWorld.xz - uBoard.xy) / uBoard.zw, 0.0, 0.9999) * uMaskSize;
    return mix(uv, vCell, step(0.5, uGlobe));
  }

  vec4 maskAtCell(vec2 cell) {
    return texture2D(uMask, (floor(cell) + 0.5) / uMaskSize);
  }

  float pulseAtCell(vec2 cell) {
    return texture2D(uPulse, clamp(cell / uMaskSize, 0.0, 0.9999)).r;
  }

  void main() {
    vec3 sunDir = normalize(uSunDir);
    vec3 col;
    if (vUp > 0.5) {
      vec2 mc = maskCell();
      vec4 m = maskAtCell(mc);
      float wet = m.r;
      float rip = m.g;
      float waveInk = m.b;
      float pool = m.a;
      float pop = pulseAtCell(mc);
      float stage = floor(wet * 5.0 + 0.001);
      float soak = smoothstep(0.01, 0.19, wet);
      float moss = smoothstep(0.18, 0.38, wet);
      float grass = smoothstep(0.36, 0.62, wet);
      float bloom = smoothstep(0.58, 0.86, wet);
      float grown = smoothstep(0.82, 0.995, wet);
      vec2 slab = vWorld.xz * 2.4;
      vec2 cell = floor(slab);
      vec2 f = fract(slab);
      float n = h21(cell);
      float n2 = h21(cell + 19.0);
      vec3 dead = mix(uDeadA, uDeadB, mix(step(0.5, n), n, uGlobe));
      dead *= 0.9 + 0.14 * h21(cell + 4.0);
      float crack = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      dead = mix(dead * 0.48, dead, smoothstep(0.0, mix(0.08, 0.55, uGlobe), crack));
      vec3 mud = mix(uDirtA, uDirtB, n);
      mud = mix(mud, vec3(0.28, 0.42, 0.18), moss * 0.65);
      vec3 water = vec3(0.28, 0.62, 0.92);
      float sx = sin(vWorld.x * 14.0 + uTime * 2.4);
      float sz = sin(vWorld.z * 11.0 - uTime * 1.8);
      float ripple = sx * sz;
      float rx = sin(vWorld.x * 30.0 + uTime * 5.2);
      float rz = sin(vWorld.z * 26.0 - uTime * 4.4);
      float hx = 14.0 * cos(vWorld.x * 14.0 + uTime * 2.4) * sz + uRain * 30.0 * cos(vWorld.x * 30.0 + uTime * 5.2) * rz;
      float hz = 11.0 * sx * cos(vWorld.z * 11.0 - uTime * 1.8) + uRain * 26.0 * rx * cos(vWorld.z * 26.0 - uTime * 4.4);
      vec3 wn = normalize(vN + vec3(-hx, 0.0, -hz) * (0.04 + uRain * 0.028));
      vec3 viewDir = normalize(cameraPosition - vWorld);
      float spec = pow(max(dot(wn, normalize(sunDir + viewDir)), 0.0), 36.0);
      float sheen = pow(max(0.0, ripple), 6.0) * (soak + pool * 0.85) * (1.0 - grass * 0.7);
      vec3 damp = mix(dead, mix(mud, water, 0.55 + sheen * 0.4), soak);
      damp += vec3(0.65, 0.9, 1.0) * sheen * 0.55;
      float sway = sin(uTime * 1.6 + vWorld.x * 6.0 + vWorld.z * 4.0);
      float gust = smoothstep(0.5, 1.0, sin(vWorld.x * 0.16 + vWorld.z * 0.11 - uTime * 1.35));
      sway += gust * 1.6;
      // grass flecks: per-cell scatter reads organic; a sin lattice reads like fabric
      vec2 wob = vec2(sway * 0.02, -sway * 0.014);
      vec2 bc = floor((vWorld.xz + wob) * 6.0);
      vec2 bf = fract((vWorld.xz + wob) * 6.0) - 0.5;
      float fleck = smoothstep(0.34, 0.08, length(vec2(bf.x, bf.y * 1.8))) * step(0.4, h21(bc));
      vec3 root = vec3(0.08, 0.32, 0.1);
      vec3 midG = mix(uLiveA, vec3(0.22, 0.62, 0.22), 0.55);
      vec3 tip = mix(uLiveB, vec3(0.42, 0.72, 0.24), 0.35);
      vec3 turf = mix(root, midG, grass);
      turf = mix(turf, tip, fleck * grass);
      turf *= 0.9 + 0.16 * n2;
      // Broad drifts of colour so a meadow is not one flat sheet of green.
      float broad = sin(vWorld.x * 0.085 + vWorld.z * 0.062) * 0.5 + 0.5;
      float broad2 = sin(vWorld.x * 0.021 - vWorld.z * 0.033 + 1.7) * 0.5 + 0.5;
      float drift = broad * 0.6 + broad2 * 0.4;
      turf = mix(turf * vec3(0.86, 0.95, 0.9), turf * vec3(1.12, 1.06, 0.82), drift);
      float petalDot = smoothstep(0.3, 0.1, length(bf * 1.5)) * step(0.965, h21(bc + 13.0));
      vec3 petal = h21(bc + 2.0) > 0.5 ? vec3(1.0, 0.45, 0.62) : vec3(1.0, 0.92, 0.55);
      turf = mix(turf, petal, petalDot * bloom * 0.9);
      turf = mix(turf, tip * 1.15, grown * fleck * 0.35);
      vec3 bladeN = normalize(vec3(sway * 0.55, 1.0, gust * 0.35));
      float bladeLit = clamp(dot(bladeN, sunDir) * 0.5 + 0.5, 0.0, 1.0);
      turf += vec3(0.72, 0.78, 0.28) * fleck * grass * bladeLit * 0.16;
      col = mix(damp, turf, clamp(grass * 0.95 + bloom * 0.2, 0.0, 1.0));
      col = mix(col, mix(uLiveA, uLiveB, fleck), grown * 0.55);
      vec2 local = fract(vWorld.xz * 3.125) - 0.5;
      float ring = smoothstep(0.22, 0.0, abs(length(local) * 2.0 - (1.0 - rip) * 1.35)) * rip;
      col += vec3(0.85, 1.0, 0.7) * ring * 0.5;
      float ink = smoothstep(0.15, 0.0, abs(length(local) * 2.0 - waveInk * 1.2)) * waveInk;
      col += vec3(0.95, 1.0, 0.55) * ink * 0.65;
      float popRing = smoothstep(0.35, 0.0, abs(length(local) * 2.0 - 0.2)) * pop;
      col += vec3(1.0, 0.98, 0.72) * popRing * (0.35 + 0.25 * sin(uTime * 9.0));
      col *= 1.0 + pop * 0.12 * (0.5 + 0.5 * sin(uTime * 12.0 + stage));
      float wetness = (soak + pool * 0.9) * (1.0 - grass * 0.55);
      col += uSunColor * spec * wetness * (0.5 + uRain * 0.4);
      vec2 vf = fract((vWorld.xz - uBoard.xy) / ${VOX.toFixed(2)});
      float seam = step(vf.x, 0.035) + step(vf.y, 0.035);
      col *= 1.0 - min(seam, 1.0) * 0.05 * (1.0 - uGlobe);
      col *= mix(0.82 + clamp(vTop, 0.0, 4.5) * 0.06, 0.94 + 0.05 * n2, uGlobe);
    } else {
      float below = vTop - vWorld.y;
      vec4 m = maskAtCell(maskCell());
      float grown = step(0.999, m.r);
      float along = vWorld.x * abs(vN.z) + vWorld.z * abs(vN.x);
      vec2 fine = floor(vec2(along, vWorld.y) * 12.5);
      float n = h21(fine);
      float band = step(0.5, fract(vWorld.y * 1.4 + h21(vec2(floor(along * 1.5), 3.0)) * 0.35));
      band = mix(band, n, uGlobe);
      vec3 rock = mix(uRockA, uRockB, band) * (0.9 + 0.18 * n);
      vec3 dirt = mix(uDirtA, uDirtB, band) * (0.88 + 0.2 * n);
      if (n > 0.94) dirt = mix(dirt, uRockA, 0.7);
      vec3 body = mix(rock, dirt, mix(grown, 0.45 + 0.3 * n, uGlobe));
      body = mix(body, rock * 0.72, smoothstep(-0.5, -2.5, vWorld.y));
      float lipDepth = 0.1 + 0.08 * h21(vec2(floor(along * 12.5), 1.0)) + grown * 0.06;
      vec3 lipCol = mix(uDeadB * 0.95, uLiveB * 0.92, grown);
      col = mix(body, lipCol, step(below, lipDepth) * (1.0 - uGlobe * 0.8));
      col *= mix(mix(0.82, 1.0, smoothstep(1.2, 0.0, below)), 0.94 + 0.05 * n, uGlobe);
    }
    vec4 lifeMask = maskAtCell(maskCell());
    float life = vUp > 0.5
      ? smoothstep(0.03, 0.78, lifeMask.r)
      : smoothstep(0.5, 0.98, lifeMask.r) * 0.62;
    float wrap = clamp(dot(normalize(vN), sunDir) * 0.5 + 0.5, 0.0, 1.0);
    col *= mix(mix(0.78, 1.08, wrap), 1.0, uGlobe);
    // Unrestored ground stays in the world's dusk. Restored ground is what the light finds.
    vec3 dusk = mix(uDusk, vec3(1.05, 0.38, 0.55), 0.72);
    col = mix(col * dusk, col * vec3(1.0, 0.98, 0.9), smoothstep(0.25, 0.88, life));
    float exposure = mix(0.58, 0.98, life);
    exposure = mix(exposure, mix(0.55, 1.05, life), uGlobe);
    col *= exposure;
    // Light should make the ground look alive, not pale. Push the colour back
    // in where the light lands instead of only adding brightness.
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, 1.0 + 0.14 * life);
    col += vec3(1.0, 0.62, 0.7) * smoothstep(0.08, 0.32, life) * (1.0 - smoothstep(0.55, 0.9, life)) * 0.18;
    col += uSunColor * smoothstep(0.72, 1.0, wrap) * 0.08 * life * (1.0 - uGlobe);
    // Thirsty ground shimmers. It keeps shimmering for patches that are nearly
    // done, so the last few cells of an island never go quiet.
    float thirsty = uSeek * (1.0 - smoothstep(0.05, 0.92, life));
    float blink = 0.55 + 0.45 * sin(uTime * 2.8 + vWorld.x * 0.9 + vWorld.z * 0.55);
    col = mix(col, vec3(1.0, 0.78, 0.22), thirsty * blink * (vUp > 0.5 ? 0.82 : 0.35));
    if (vUp > 0.5) {
      float cd = length(vWorld.xz - uCloud.xy);
      float shadow = (1.0 - smoothstep(uCloud.z * 0.28, uCloud.z, cd)) * (1.0 - uGlobe);
      col *= 1.0 - shadow * 0.5 * (0.3 + life);
      col = mix(col, col * vec3(0.7, 0.58, 0.66), uRain * 0.22 * (1.0 - life * 0.7));
    }
    // Aerial haze: the far end of the island fades into the sky, which is what
    // makes the land feel big.
    float fogDepth = length(vWorld - cameraPosition);
    col = mix(col, uFog, smoothstep(uFogRange.x, uFogRange.y, fogDepth) * (1.0 - uGlobe * 0.85));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const FLORA_VERT = /* glsl */ `
  attribute vec4 aSpot;
  attribute vec2 aFrame;
  uniform sampler2D uMask;
  uniform sampler2D uPulse;
  uniform vec2 uMaskSize;
  uniform vec4 uBoard;
  uniform float uTime;
  varying vec2 vUv;
  varying float vDepth;
  varying vec3 vT;
  varying vec3 vB;
  varying vec3 vN;
  varying float vLife;
  void main() {
    vec2 muv = clamp((aSpot.xz - uBoard.xy) / uBoard.zw, 0.0, 0.9999);
    vec4 m = texture2D(uMask, (floor(muv * uMaskSize) + 0.5) / uMaskSize);
    float wet = m.r;
    float sprout = smoothstep(0.08, 0.28, wet);
    float grass = smoothstep(0.32, 0.58, wet);
    float grove = smoothstep(0.58, 0.9, wet);
    float grown = max(grass, grove);
    float frame = mix(aFrame.x, aFrame.y, step(0.42, wet));
    float hidden = step(2.5, frame) * step(frame, 3.5) * (1.0 - sprout);
    float pop = 1.0 + texture2D(uPulse, muv).r * 0.4;
    float tier = mix(0.22, 0.7, sprout);
    tier = mix(tier, 1.15, grass);
    tier = mix(tier, 1.55, grove);
    float size = aSpot.w * pop * (1.0 - hidden) * tier;
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    float gust = smoothstep(0.5, 1.0, sin(aSpot.x * 0.16 + aSpot.z * 0.11 - uTime * 1.35));
    float sway =
      (sin(uTime * 1.8 + aSpot.x * 3.0 + aSpot.z * 2.0) * mix(0.02, 0.1, grown) + gust * 0.11 * grown) *
      position.y;
    vec3 wp = aSpot.xyz + right * (position.x + sway) * size + vec3(0.0, position.y * size, 0.0);
    vec3 tangent = right;
    vec3 bitangent = vec3(0.0, 1.0, 0.0);
    vec3 facing = cross(tangent, bitangent);
    if (dot(facing, cameraPosition - wp) < 0.0) {
      facing = -facing;
      tangent = -tangent;
    }
    facing = normalize(facing + tangent * sway * 1.6);
    vT = tangent;
    vB = bitangent;
    vN = facing;
    vLife = smoothstep(0.06, 0.75, wet);
    vUv = vec2((frame + position.x + 0.5) / 16.0, position.y);
    vec4 mv = viewMatrix * vec4(wp, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FLORA_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform sampler2D uNormal;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  varying vec2 vUv;
  varying float vDepth;
  varying vec3 vT;
  varying vec3 vB;
  varying vec3 vN;
  varying float vLife;
  void main() {
    vec4 c = texture2D(uAtlas, vUv);
    if (c.a < 0.5) discard;
    vec3 albedo = pow(c.rgb, vec3(2.2));
    vec3 nTex = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
    vec3 N = normalize(vT * nTex.x + vB * nTex.y + vN * nTex.z);
    float wrap = clamp(dot(N, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
    float lit = mix(0.16, 1.18, vLife);
    vec3 col = albedo * lit * mix(0.7, 1.15, wrap);
    float rim = pow(wrap, 2.2) * clamp(1.0 - nTex.z, 0.0, 1.0);
    col += albedo * uSunColor * rim * 0.4 * vLife;
    float fogDepth = vDepth;
    col = mix(col, uFog, smoothstep(uFogRange.x, uFogRange.y, fogDepth));
    gl_FragColor = vec4(col, 1.0);
  }
`;
