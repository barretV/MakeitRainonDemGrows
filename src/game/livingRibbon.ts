import * as THREE from 'three';
import { GLOBE_WORLD, TILE, flairWorldPoint, gridOf, islandRadius, islandShore } from './balance';

/** How many wetness samples a ribbon is split into. */
export const RIBBON_SEGMENTS = 12;

export type RibbonKind = 'brook' | 'ice' | 'mirage' | 'sludge' | 'reef';

export interface RibbonPoint {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  u: number;
  v: number;
}

export interface RibbonDef {
  id: string;
  world: number;
  kind: RibbonKind;
  path: readonly { u: number; v: number }[];
  halfWidth: number;
  /** Closed loop, used by the reef that wraps the globe. */
  closed?: boolean;
}

export interface RibbonLife {
  mesh: THREE.Mesh;
  seg: number;
  base: number;
  /** 0 reed, 1 fish, 2 flyer, 3 palm or coral. */
  role: number;
}

export interface LivingRibbon {
  def: RibbonDef;
  root: THREE.Group;
  mesh: THREE.Mesh;
  fills: Float32Array;
  /** UV at the middle of each segment, where wetness is sampled. */
  segmentUv: { u: number; v: number }[];
  life: RibbonLife[];
  /** Subdivided centerline, for creatures that travel the water. */
  samples: RibbonPoint[];
  sampleSeg: number[];
}

export interface RibbonKit {
  reed: THREE.Texture;
  fish: THREE.Texture;
  fly: THREE.Texture;
  palm: THREE.Texture;
  coral: THREE.Texture;
  mote: THREE.Texture;
}

const KIND_ID: Record<RibbonKind, number> = {
  brook: 0,
  ice: 1,
  mirage: 2,
  sludge: 3,
  reef: 4,
};

function ringUv(world: number, angle: number, radial: number): { u: number; v: number } {
  const { cols, rows } = gridOf(world);
  const w = cols * TILE;
  const h = rows * TILE;
  const radius = islandRadius(world, w, h) * radial;
  const cx = -TILE / 2 + w * 0.5;
  const cz = -TILE / 2 + h * 0.5;
  const x = cx + Math.cos(angle) * radius;
  const z = cz + Math.sin(angle) * radius;
  return { u: (x + TILE / 2) / w, v: (z + TILE / 2) / h };
}

/** Pull a point onto land. The desert's hole is the center, so that world is pushed out onto the ring. */
export function settleOnLand(world: number, u: number, v: number): { u: number; v: number } {
  if (world === GLOBE_WORLD) return { u, v };
  let pu = u;
  let pv = v;
  const { cols, rows } = gridOf(world);
  const w = cols * TILE;
  const h = rows * TILE;
  const radius = islandRadius(world, w, h);
  const cx = -TILE / 2 + w * 0.5;
  const cz = -TILE / 2 + h * 0.5;
  for (let i = 0; i < 10; i += 1) {
    const at = flairWorldPoint(world, pu, pv);
    const shore = islandShore(world, at.x - cx, at.z - cz, radius);
    if (shore < -0.05) return { u: pu, v: pv };
    if (world === 2) {
      const dx = at.x - cx;
      const dz = at.z - cz;
      const len = Math.hypot(dx, dz) || 1;
      const target = radius * 0.7;
      const x = cx + (dx / len) * target;
      const z = cz + (dz / len) * target;
      pu = (x + TILE / 2) / w;
      pv = (z + TILE / 2) / h;
    } else {
      pu = pu * 0.8 + 0.5 * 0.2;
      pv = pv * 0.8 + 0.5 * 0.2;
    }
  }
  return { u: pu, v: pv };
}

export function ribbonsForWorld(world: number): RibbonDef[] {
  if (world === 0) {
    return [
      {
        id: 'mossbrook',
        world: 0,
        kind: 'brook',
        halfWidth: 0.52,
        path: [
          { u: 0.16, v: 0.5 },
          { u: 0.28, v: 0.56 },
          { u: 0.4, v: 0.58 },
          { u: 0.46, v: 0.46 },
          { u: 0.45, v: 0.36 },
          { u: 0.58, v: 0.4 },
          { u: 0.72, v: 0.48 },
          { u: 0.86, v: 0.44 },
        ],
      },
    ];
  }
  if (world === 1) {
    return [
      {
        id: 'glassmere',
        world: 1,
        kind: 'ice',
        halfWidth: 0.7,
        path: [
          { u: 0.18, v: 0.5 },
          { u: 0.32, v: 0.56 },
          { u: 0.36, v: 0.58 },
          { u: 0.5, v: 0.5 },
          { u: 0.66, v: 0.44 },
          { u: 0.82, v: 0.5 },
        ],
      },
    ];
  }
  if (world === 2) {
    const path = [-2.4, -1.7, -1.0, -0.3, 0.4, 1.1, 1.8].map((a) => ringUv(2, a, 0.7));
    return [{ id: 'mirage', world: 2, kind: 'mirage', halfWidth: 0.62, path }];
  }
  if (world === 3) {
    return [
      {
        id: 'canal',
        world: 3,
        kind: 'sludge',
        halfWidth: 0.66,
        path: [
          { u: 0.34, v: 0.48 },
          { u: 0.42, v: 0.58 },
          { u: 0.5, v: 0.5 },
          { u: 0.58, v: 0.42 },
          { u: 0.66, v: 0.5 },
        ],
      },
    ];
  }
  if (world === GLOBE_WORLD) {
    const path: { u: number; v: number }[] = [];
    for (let i = 0; i <= 16; i += 1) {
      const u = i / 16;
      path.push({ u, v: 0.42 + Math.sin(u * Math.PI * 2) * 0.035 });
    }
    return [{ id: 'reefbelt', world: GLOBE_WORLD, kind: 'reef', halfWidth: 0.72, path, closed: true }];
  }
  return [];
}

function subdivide(path: readonly { u: number; v: number }[], steps: number): { u: number; v: number }[] {
  const out: { u: number; v: number }[] = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i]!;
    const b = path[i + 1]!;
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      out.push({ u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t });
    }
  }
  const last = path[path.length - 1];
  if (last) out.push(last);
  return out;
}

function billboard(map: THREE.Texture, w: number, h: number, color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map,
      color,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.userData['bb'] = 1;
  mesh.visible = false;
  return mesh;
}

/**
 * A strip of bed and water laid on the ground. Fill is written per vertex each
 * frame from the wetness under that stretch.
 */
export function buildLivingRibbon(
  def: RibbonDef,
  place: (u: number, v: number) => RibbonPoint,
  time: { value: number },
  kit: RibbonKit,
): LivingRibbon {
  const raw = subdivide(def.path, 4);
  const samples = raw.map((p) => {
    const settled = settleOnLand(def.world, p.u, p.v);
    return place(settled.u, settled.v);
  });
  const segOf = samples.map((_, i) =>
    Math.min(RIBBON_SEGMENTS - 1, Math.floor((i / Math.max(1, samples.length - 1)) * RIBBON_SEGMENTS)),
  );
  const positions: number[] = [];
  const along: number[] = [];
  const side: number[] = [];
  const fill: number[] = [];
  const index: number[] = [];
  let travelled = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const p = samples[i]!;
    const next = samples[Math.min(samples.length - 1, i + 1)]!;
    const prev = samples[Math.max(0, i - 1)]!;
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, ty, tz) || 1;
    tx /= len;
    ty /= len;
    tz /= len;
    let sx = p.ny * tz - p.nz * ty;
    let sy = p.nz * tx - p.nx * tz;
    let sz = p.nx * ty - p.ny * tx;
    const sl = Math.hypot(sx, sy, sz) || 1;
    sx /= sl;
    sy /= sl;
    sz /= sl;
    const yLift = 0.07;
    const hw = def.halfWidth;
    positions.push(
      p.x + sx * hw + p.nx * yLift,
      p.y + sy * hw + p.ny * yLift,
      p.z + sz * hw + p.nz * yLift,
      p.x - sx * hw + p.nx * yLift,
      p.y - sy * hw + p.ny * yLift,
      p.z - sz * hw + p.nz * yLift,
    );
    if (i > 0) travelled += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    along.push(travelled, travelled);
    side.push(1, -1);
    fill.push(0, 0);
    if (i < samples.length - 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  geo.setAttribute('aFill', new THREE.Float32BufferAttribute(fill, 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: time,
        uKind: { value: KIND_ID[def.kind] },
      },
      vertexShader: /* glsl */ `
        attribute float aAlong;
        attribute float aSide;
        attribute float aFill;
        varying float vAlong;
        varying float vSide;
        varying float vFill;
        void main() {
          vAlong = aAlong;
          vSide = aSide;
          vFill = aFill;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uKind;
        varying float vAlong;
        varying float vSide;
        varying float vFill;
        void main() {
          float fill = clamp(vFill, 0.0, 1.0);
          if (fill < 0.045) discard;
          float width = mix(0.28, 1.0, smoothstep(0.06, 0.72, fill));
          if (abs(vSide) > width) discard;
          float edge = smoothstep(width, width * 0.55, abs(vSide));
          float water = smoothstep(0.16, 0.5, fill);
          float flow = fract(vAlong * 0.42 - uTime * mix(0.15, 0.62, water));
          float streak = smoothstep(0.0, 0.32, flow) * smoothstep(1.0, 0.48, flow);
          vec3 bed = vec3(0.28, 0.22, 0.16);
          vec3 wet = vec3(0.45, 0.72, 0.86);
          float alpha = 0.55;
          if (uKind < 0.5) {
            bed = vec3(0.32, 0.26, 0.18);
            wet = vec3(0.55, 0.82, 0.95);
          } else if (uKind < 1.5) {
            bed = vec3(0.78, 0.88, 0.94);
            wet = vec3(0.72, 0.9, 0.98);
            water *= smoothstep(0.34, 0.62, fill);
            alpha = 0.62;
          } else if (uKind < 2.5) {
            bed = vec3(0.72, 0.58, 0.32);
            wet = vec3(0.45, 0.78, 0.92);
            float shimmer = 0.5 + 0.5 * sin(vAlong * 6.0 + uTime * 2.4);
            bed += vec3(0.15, 0.1, 0.02) * shimmer * (1.0 - water);
            alpha = mix(0.28, 0.7, water);
          } else if (uKind < 3.5) {
            bed = vec3(0.28, 0.36, 0.16);
            wet = mix(vec3(0.45, 0.62, 0.18), vec3(0.55, 0.84, 0.78), smoothstep(0.4, 0.85, fill));
          } else {
            bed = vec3(0.1, 0.32, 0.34);
            wet = vec3(0.2, 0.78, 0.72);
            alpha = 0.72;
          }
          vec3 col = mix(bed, wet, water);
          col += vec3(1.0) * streak * water * 0.45;
          float cracks = step(0.82, fract(vAlong * 3.5 + vSide * 2.0)) * (1.0 - water);
          col *= 1.0 - cracks * 0.35;
          float a = edge * alpha * smoothstep(0.045, 0.14, fill);
          if (a < 0.02) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
    }),
  );
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;

  const segmentUv: { u: number; v: number }[] = [];
  for (let s = 0; s < RIBBON_SEGMENTS; s += 1) {
    let sumU = 0;
    let sumV = 0;
    let n = 0;
    for (let i = 0; i < samples.length; i += 1) {
      if (segOf[i] !== s) continue;
      sumU += samples[i]!.u;
      sumV += samples[i]!.v;
      n += 1;
    }
    const fallback = samples[Math.min(samples.length - 1, Math.floor((s / RIBBON_SEGMENTS) * samples.length))]!;
    segmentUv.push(n > 0 ? { u: sumU / n, v: sumV / n } : { u: fallback.u, v: fallback.v });
  }

  const root = new THREE.Group();
  root.name = def.id;
  root.add(mesh);
  const life: RibbonLife[] = [];
  const add = (texture: THREE.Texture, w: number, h: number, color: string, seg: number, role: number, at: RibbonPoint) => {
    const sprite = billboard(texture, w, h, color);
    sprite.position.set(
      at.x + at.nx * 0.2,
      at.y + at.ny * (h * 0.5) + 0.05,
      at.z + at.nz * 0.2,
    );
    root.add(sprite);
    life.push({ mesh: sprite, seg, base: 1, role });
  };

  for (let s = 0; s < RIBBON_SEGMENTS; s += 2) {
    const at = samples.find((_, i) => segOf[i] === s) ?? samples[0]!;
    if (def.kind === 'brook') add(kit.reed, 0.34, 0.78, '#ffffff', s, 0, at);
    if (def.kind === 'mirage' && s % 4 === 0) add(kit.palm, 0.7, 1.15, '#ffffff', s, 3, at);
    if (def.kind === 'reef' && s % 4 === 0) add(kit.coral, 0.42, 0.55, '#ffffff', s, 3, at);
    if (def.kind === 'ice') add(kit.mote, 0.28, 0.28, '#d8f6ff', s, 2, at);
    if (def.kind === 'sludge') add(kit.fly, 0.32, 0.26, '#c6ff6a', s, 2, at);
    if (def.kind === 'brook' && s % 4 === 0) add(kit.fly, 0.3, 0.24, '#ffffff', s, 2, at);
  }
  for (let n = 0; n < 4; n += 1) {
    const seg = Math.min(RIBBON_SEGMENTS - 1, 1 + n * 3);
    const at = samples.find((_, i) => segOf[i] === seg) ?? samples[0]!;
    if (def.kind === 'brook' || def.kind === 'ice' || def.kind === 'sludge') {
      add(kit.fish, 0.36, 0.22, def.kind === 'sludge' ? '#9ad26a' : '#ffffff', seg, 1, at);
    }
  }

  return {
    def,
    root,
    mesh,
    fills: new Float32Array(RIBBON_SEGMENTS),
    segmentUv,
    life,
    samples,
    sampleSeg: segOf,
  };
}

/** Writes per-vertex fill from the 12 segment values and poses creatures. */
export function poseLivingRibbon(ribbon: LivingRibbon, t: number): void {
  const attr = ribbon.mesh.geometry.getAttribute('aFill') as THREE.BufferAttribute;
  const segCount = ribbon.sampleSeg.length;
  for (let i = 0; i < segCount; i += 1) {
    const seg = ribbon.sampleSeg[i] ?? 0;
    const fill = ribbon.fills[seg] ?? 0;
    attr.setX(i * 2, fill);
    attr.setX(i * 2 + 1, fill);
  }
  attr.needsUpdate = true;

  let wetCursor = 0;
  for (const creature of ribbon.life) {
    const fill = ribbon.fills[creature.seg] ?? 0;
    const need = creature.role === 1 ? 0.7 : creature.role === 2 ? 0.5 : 0.72;
    creature.mesh.visible = fill >= need;
    if (!creature.mesh.visible) continue;
    const pop = Math.min(1, (fill - need) / 0.22);
    if (creature.role === 1) {
      wetCursor += 1;
      const wet: number[] = [];
      for (let i = 0; i < ribbon.samples.length; i += 1) {
        if ((ribbon.fills[ribbon.sampleSeg[i] ?? 0] ?? 0) >= 0.7) wet.push(i);
      }
      if (wet.length > 0) {
        const along = (t * 0.35 + wetCursor * 0.17) % 1;
        const idx = wet[Math.floor(along * wet.length) % wet.length] ?? 0;
        const at = ribbon.samples[idx]!;
        creature.mesh.position.set(at.x + at.nx * 0.16, at.y + at.ny * 0.16, at.z + at.nz * 0.16);
      }
      creature.mesh.scale.setScalar(Math.max(0.05, pop));
    } else if (creature.role === 2) {
      const hover = Math.sin(t * 2.2 + creature.seg) * 0.18;
      const base = ribbon.samples.find((_, i) => ribbon.sampleSeg[i] === creature.seg) ?? ribbon.samples[0]!;
      creature.mesh.position.set(
        base.x + base.nx * (0.55 + hover),
        base.y + base.ny * (0.55 + hover),
        base.z + base.nz * (0.55 + hover),
      );
      creature.mesh.scale.setScalar(Math.max(0.05, pop));
    } else {
      creature.mesh.scale.setScalar(Math.max(0.05, pop));
    }
  }
}
