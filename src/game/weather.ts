import * as THREE from 'three';
import type { AbilityId } from './abilities';
import type { SaveState } from './state';

/** Where the player's cloud is when a weather event starts. */
export interface CastOrigin {
  cloudX: number;
  cloudZ: number;
  faceX: number;
  faceZ: number;
}

export interface WeatherHost {
  scene: THREE.Scene;
  drop: THREE.Texture;
  baby: THREE.Texture;
  tornado: THREE.Texture;
  place(mesh: THREE.Object3D, x: number, z: number, lift: number): void;
  /** How far the cloud sits above the ground, in the same units `place` uses for lift. */
  cloudLift(): number;
  shake(amount: number): void;
  zap(): void;
  label(x: number, y: number, z: number, text: string): void;
  spark(x: number, y: number, z: number, count: number): void;
  spinCloud(seconds: number): void;
}

const MAX_ACTORS = 10;

interface Sprinkler {
  kind: 'sprinkler';
  age: number;
  life: number;
  jets: number;
  reach: number;
  drops: THREE.Mesh[];
  acc: number;
  x: number;
  z: number;
}

interface Bolt {
  kind: 'bolt';
  age: number;
  delay: number;
  life: number;
  x: number;
  z: number;
  mesh: THREE.Mesh;
  hit: boolean;
  limit: number;
}

interface Spout {
  kind: 'spout';
  age: number;
  life: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  mesh: THREE.Mesh;
  acc: number;
  retarget: number;
  vx: number;
  vz: number;
}

interface Drone {
  kind: 'drone';
  phase: 'out' | 'rain' | 'home';
  age: number;
  hold: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  mesh: THREE.Mesh;
  drops: THREE.Mesh[];
  acc: number;
}

interface Geyser {
  kind: 'geyser';
  age: number;
  life: number;
  x: number;
  z: number;
  drops: THREE.Mesh[];
  popped: boolean;
  limit: number;
  radius: number;
}

interface Bomb {
  kind: 'bomb';
  age: number;
  life: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  mesh: THREE.Mesh;
  boomed: boolean;
  limit: number;
  radius: number;
}

interface Sheet {
  kind: 'sheet';
  tag: 'tide' | 'mirage' | 'monsoon';
  age: number;
  life: number;
  x: number;
  z: number;
  dx: number;
  dz: number;
  width: number;
  speed: number;
  drops: THREE.Mesh[];
  acc: number;
  soaked: boolean;
}

interface Hail {
  kind: 'hail';
  age: number;
  life: number;
  x: number;
  z: number;
  drops: THREE.Mesh[];
  hit: boolean;
  limit: number;
}

interface Arc {
  kind: 'arc';
  age: number;
  life: number;
  x: number;
  z: number;
  meshes: THREE.Mesh[];
  acc: number;
  span: number;
  faceX: number;
  faceZ: number;
}

interface Sit {
  kind: 'sit';
  tag: 'spore' | 'purify';
  age: number;
  life: number;
  x: number;
  z: number;
  mesh: THREE.Mesh;
  drops: THREE.Mesh[];
  acc: number;
  done: boolean;
}

type Actor = Sprinkler | Bolt | Spout | Drone | Geyser | Bomb | Sheet | Hail | Arc | Sit;

function boltGeometry(height: number, width: number): THREE.BufferGeometry {
  const segments = 7;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const edge = i === 0 || i === segments;
    const zig = edge ? 0 : (i % 2 === 0 ? 1 : -1) * width * (1.1 + (i % 3) * 0.6);
    points.push(new THREE.Vector2(zig, height * (0.5 - t)));
  }
  const positions = new Float32Array((segments + 1) * 2 * 3);
  const uvs = new Float32Array((segments + 1) * 2 * 2);
  const index: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = i === 0 || i === points.length - 1 ? width * 0.45 : width;
    const base = i * 6;
    positions[base] = p.x + nx * w;
    positions[base + 1] = p.y + ny * w;
    positions[base + 2] = 0;
    positions[base + 3] = p.x - nx * w;
    positions[base + 4] = p.y - ny * w;
    positions[base + 5] = 0;
    const u = i * 4;
    uvs[u] = 0;
    uvs[u + 1] = i / segments;
    uvs[u + 2] = 1;
    uvs[u + 3] = i / segments;
    if (i < segments) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(index);
  return geo;
}

function approach(x: number, z: number, tx: number, tz: number, speed: number, dt: number): { x: number; z: number; arrived: boolean } {
  const dx = tx - x;
  const dz = tz - z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.28) return { x: tx, z: tz, arrived: true };
  const step = Math.min(dist, speed * dt);
  return { x: x + (dx / dist) * step, z: z + (dz / dist) * step, arrived: false };
}

/**
 * The storms. Each one is a short-lived actor with its own shape.
 * Droplets come from a pool so a busy bottle does not allocate.
 */
export class Weather {
  private readonly actors: Actor[] = [];
  private readonly pool: THREE.Mesh[] = [];
  private readonly held = new Set<THREE.Mesh>();
  private readonly dropGeo = new THREE.PlaneGeometry(0.22, 0.34);
  private readonly own: THREE.Object3D[] = [];
  private readonly splashes: { mesh: THREE.Mesh; life: number }[] = [];

  constructor(private readonly host: WeatherHost) {
    for (let i = 0; i < 80; i += 1) {
      const mesh = new THREE.Mesh(
        this.dropGeo,
        new THREE.MeshBasicMaterial({
          map: host.drop,
          transparent: true,
          alphaTest: 0.08,
          depthWrite: false,
          color: '#d7f4ff',
        }),
      );
      mesh.visible = false;
      mesh.userData['bb'] = 1;
      host.scene.add(mesh);
      this.pool.push(mesh);
    }
  }

  /** The storm the cloud should react to, if one is on screen. */
  faceCue(): string | null {
    const rank = ['sprinkler', 'bolt', 'geyser', 'bomb', 'spout', 'sheet', 'drone', 'arc', 'hail'];
    for (const kind of rank) {
      if (this.actors.some((actor) => actor.kind === kind)) return kind;
    }
    return null;
  }

  /** Start one weather event. False means try again next frame (the sky is full). */
  spawn(id: AbilityId, state: SaveState, origin: CastOrigin): boolean {
    if (this.actors.length >= MAX_ACTORS) return false;
    switch (id) {
      case 'sprinkler':
        return this.spawnSprinkler(state, origin);
      case 'drone':
        return this.spawnDrones(state, origin);
      case 'lightning':
        return this.spawnBolt(state, origin);
      case 'tornado':
        return this.spawnSpout(state, origin);
      case 'geyser':
        return this.spawnGeyser(state, origin);
      case 'waterbomb':
        return this.spawnBomb(state, origin);
      case 'tide':
        return this.spawnSheet(state, origin, 'tide');
      case 'mirage':
        return this.spawnSheet(state, origin, 'mirage');
      case 'monsoon':
        return this.spawnSheet(state, origin, 'monsoon');
      case 'hail':
        return this.spawnHail(state, origin);
      case 'rainbow':
        return this.spawnArc(state, origin);
      case 'spore':
        return this.spawnSit(state, origin, 'spore');
      case 'purify':
        return this.spawnSit(state, origin, 'purify');
      default:
        return false;
    }
  }

  update(dt: number, cloudX: number, cloudZ: number, state: SaveState | null): void {
    for (let i = this.actors.length - 1; i >= 0; i -= 1) {
      const actor = this.actors[i];
      if (!actor) continue;
      actor.age += dt;
      const dead = this.step(actor, dt, cloudX, cloudZ, state);
      if (dead) {
        this.release(actor);
        this.actors.splice(i, 1);
      }
    }
    this.stepSplashes(dt);
  }

  clear(): void {
    for (const actor of this.actors) this.release(actor);
    this.actors.length = 0;
    for (const mesh of this.pool) {
      mesh.visible = false;
      mesh.scale.set(1, 1, 1);
    }
    this.held.clear();
    for (const splash of this.splashes) {
      this.host.scene.remove(splash.mesh);
      splash.mesh.geometry.dispose();
      (splash.mesh.material as THREE.Material).dispose();
    }
    this.splashes.length = 0;
  }

  dispose(): void {
    this.clear();
    for (const mesh of this.pool) {
      this.host.scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
    }
    this.pool.length = 0;
    this.dropGeo.dispose();
  }

  private spawnSprinkler(state: SaveState, origin: CastOrigin): boolean {
    const jets = 4 + Math.min(3, state.ranks.spin);
    const drops = this.takeMany('#f4fcff', jets * 5);
    if (drops.length < 4) {
      this.giveAll(drops);
      return false;
    }
    const reach = state.reach() * (1.05 + state.ranks.spin * 0.2);
    state.siphonPoolToCenter(origin.cloudX, origin.cloudZ, reach * 0.85);
    this.host.spinCloud(1.9);
    this.host.label(origin.cloudX, 2.4, origin.cloudZ, 'SPRINKLER');
    this.actors.push({
      kind: 'sprinkler',
      age: 0,
      life: 1.9,
      jets,
      reach,
      drops,
      acc: 0,
      x: origin.cloudX,
      z: origin.cloudZ,
    });
    return true;
  }

  private spawnDrones(state: SaveState, origin: CastOrigin): boolean {
    const count = Math.max(1, Math.min(3, state.ranks.drone));
    const room = MAX_ACTORS - this.actors.length;
    const n = Math.min(count, room);
    if (n <= 0) return false;
    let made = 0;
    for (let i = 0; i < n; i += 1) {
      const mesh = this.sprite(this.host.baby, 0.72, 0.46, '#f4fbff');
      if (!mesh) break;
      const angle = (i / n) * Math.PI * 2 + 0.4;
      const spot = state.driestNear(
        origin.cloudX + Math.cos(angle) * 2,
        origin.cloudZ + Math.sin(angle) * 2,
        Math.max(1.6, state.reach()),
        14,
      );
      const tx = spot?.x ?? origin.cloudX + Math.cos(angle) * 4;
      const tz = spot?.z ?? origin.cloudZ + Math.sin(angle) * 4;
      const drops = this.takeMany('#c5ecff', 4);
      this.host.scene.add(mesh);
      this.own.push(mesh);
      this.actors.push({
        kind: 'drone',
        phase: 'out',
        age: 0,
        hold: 0,
        x: origin.cloudX,
        z: origin.cloudZ,
        tx,
        tz,
        mesh,
        drops,
        acc: 0,
      });
      made += 1;
    }
    if (made === 0) return false;
    this.host.label(origin.cloudX, 2.6, origin.cloudZ, made > 1 ? 'DRONES' : 'DRONE');
    return true;
  }

  private spawnBolt(state: SaveState, origin: CastOrigin): boolean {
    const spot = state.driestNear(origin.cloudX, origin.cloudZ, Math.max(1.5, state.reach() * 0.9), 12);
    if (!spot) return true;
    const mesh = new THREE.Mesh(boltGeometry(5.6, 0.16), boltMaterial());
    mesh.userData['bb'] = 1;
    mesh.visible = false;
    this.host.scene.add(mesh);
    this.own.push(mesh);
    const limit = 3 + state.ranks.zap;
    this.actors.push({ kind: 'bolt', age: 0, delay: 0, life: 0.55, x: spot.x, z: spot.z, mesh, hit: false, limit });
    if (state.ranks.zap >= 1 && this.actors.length < MAX_ACTORS) {
      const extra = state.driestNear(spot.x, spot.z, 1.8, 8) ?? spot;
      const mesh2 = new THREE.Mesh(boltGeometry(5.2, 0.14), boltMaterial());
      mesh2.userData['bb'] = 1;
      mesh2.visible = false;
      this.host.scene.add(mesh2);
      this.own.push(mesh2);
      this.actors.push({
        kind: 'bolt',
        age: 0,
        delay: 0.42,
        life: 0.95,
        x: extra.x,
        z: extra.z,
        mesh: mesh2,
        hit: false,
        limit,
      });
    }
    this.host.label(spot.x, 3.2, spot.z, 'BOLT');
    return true;
  }

  private spawnSpout(state: SaveState, origin: CastOrigin): boolean {
    if (this.actors.some((a) => a.kind === 'spout')) return false;
    const spot = state.driestNear(origin.cloudX, origin.cloudZ, 1.2, 8);
    const mesh = this.sprite(this.host.tornado, 1.25 + state.ranks.twist * 0.12, 1.7, state.ranks.twist >= 2 ? '#b6ffcf' : '#e7f7ff');
    if (!mesh) return false;
    this.host.scene.add(mesh);
    this.own.push(mesh);
    const face = Math.hypot(origin.faceX, origin.faceZ) || 1;
    this.actors.push({
      kind: 'spout',
      age: 0,
      life: 3.2 + state.ranks.twist * 0.35,
      x: origin.cloudX,
      z: origin.cloudZ,
      tx: spot?.x ?? origin.cloudX + (origin.faceX / face) * 4,
      tz: spot?.z ?? origin.cloudZ + (origin.faceZ / face) * 4,
      mesh,
      acc: 0,
      retarget: 0.4,
      vx: origin.faceX / face,
      vz: origin.faceZ / face,
    });
    this.host.label(origin.cloudX, 2.2, origin.cloudZ, 'SPOUT');
    this.host.zap();
    return true;
  }

  private spawnGeyser(state: SaveState, origin: CastOrigin): boolean {
    const made = this.addGeyser(state, origin.cloudX, origin.cloudZ, false);
    if (!made) return false;
    if (state.ranks.geyser >= 3 && this.actors.length < MAX_ACTORS) {
      this.addGeyser(state, origin.cloudX + 2.4, origin.cloudZ - 1.6, true);
    }
    return true;
  }

  private addGeyser(state: SaveState, ox: number, oz: number, quiet: boolean): boolean {
    const spot = state.driestNear(ox, oz, quiet ? 2.2 : 1.6, quiet ? 7 : 10);
    if (!spot) return true;
    const drops = this.takeMany('#9fd4ff', 7);
    if (drops.length < 3) {
      this.giveAll(drops);
      return false;
    }
    this.actors.push({
      kind: 'geyser',
      age: 0,
      life: 1.25,
      x: spot.x,
      z: spot.z,
      drops,
      popped: false,
      limit: 3 + Math.min(3, state.ranks.geyser),
      radius: 0.38 + state.ranks.geyser * 0.04,
    });
    if (!quiet) this.host.label(spot.x, 1.8, spot.z, 'GEYSER');
    return true;
  }

  private spawnBomb(state: SaveState, origin: CastOrigin): boolean {
    const face = Math.hypot(origin.faceX, origin.faceZ) || 1;
    const nx = origin.faceX / face;
    const nz = origin.faceZ / face;
    const ahead = state.driestNear(origin.cloudX + nx * state.reach(), origin.cloudZ + nz * state.reach(), 0.6, 11);
    const mesh = this.take('#9fd8ff');
    if (!mesh) return false;
    mesh.scale.setScalar(2.5);
    const x1 = ahead?.x ?? origin.cloudX + nx * (2.2 + state.ranks.waterbomb * 0.25);
    const z1 = ahead?.z ?? origin.cloudZ + nz * (2.2 + state.ranks.waterbomb * 0.25);
    this.actors.push({
      kind: 'bomb',
      age: 0,
      life: 0.85,
      x0: origin.cloudX,
      z0: origin.cloudZ,
      x1,
      z1,
      mesh,
      boomed: false,
      limit: 10 + state.ranks.waterbomb * 3,
      radius: 0.72 + state.ranks.waterbomb * 0.06,
    });
    this.host.label(origin.cloudX, 2.8, origin.cloudZ, 'BOMB');
    return true;
  }

  private spawnSheet(state: SaveState, origin: CastOrigin, tag: Sheet['tag']): boolean {
    if (tag === 'tide' && this.actors.some((a) => a.kind === 'sheet' && a.tag === 'tide')) return false;
    if (tag === 'monsoon') {
      state.monsoonBand(state.ranks.monsoon);
      const drops = this.takeMany('#9fdcff', 10);
      if (drops.length === 0) return true;
      this.actors.push({
        kind: 'sheet',
        tag,
        age: 0,
        life: 1.5,
        x: origin.cloudX,
        z: origin.cloudZ,
        dx: 1,
        dz: 0,
        width: state.reach() * 2.2,
        speed: 0.35,
        drops,
        acc: 10,
        soaked: true,
      });
      this.host.label(origin.cloudX, 2.4, origin.cloudZ, 'MONSOON');
      return true;
    }
    const travel = Math.min(state.islandCoverRadius() * (tag === 'tide' ? 0.72 : 0.4), tag === 'tide' ? 14 : 7);
    const run = state.sheetRun(Math.max(3, travel));
    if (!run) return true;
    const width = tag === 'tide' ? 2.4 + state.ranks.tide * 0.45 : 1.6 + state.ranks.mirage * 0.2;
    const drops = this.takeMany(tag === 'tide' ? '#8ecfff' : '#ffe3a3', tag === 'tide' ? 11 : 7);
    if (drops.length < 3) {
      this.giveAll(drops);
      return false;
    }
    this.actors.push({
      kind: 'sheet',
      tag,
      age: 0,
      life: run.length / (tag === 'tide' ? 3.6 : 3.1) + 0.2,
      x: run.x,
      z: run.z,
      dx: run.dx,
      dz: run.dz,
      width,
      speed: tag === 'tide' ? 3.6 : 3.1,
      drops,
      acc: 0,
      soaked: false,
    });
    this.host.label(run.x, 1.6, run.z, tag === 'tide' ? 'TIDE' : 'WAVE');
    return true;
  }

  private spawnHail(state: SaveState, origin: CastOrigin): boolean {
    const spot = state.driestNear(origin.cloudX, origin.cloudZ, 0.8, 10) ?? { x: origin.cloudX, z: origin.cloudZ };
    const drops = this.takeMany('#f4fbff', 8);
    if (drops.length < 3) {
      this.giveAll(drops);
      return false;
    }
    this.actors.push({
      kind: 'hail',
      age: 0,
      life: 0.7,
      x: spot.x,
      z: spot.z,
      drops,
      hit: false,
      limit: 4 + state.ranks.hail,
    });
    this.host.label(spot.x, 2.6, spot.z, 'HAIL');
    return true;
  }

  private spawnArc(state: SaveState, origin: CastOrigin): boolean {
    const span = state.reach() * 1.25;
    const colors = ['#ff6b9d', '#ffd56a', '#7ddf6a', '#6ec8ff', '#c9a0ff'];
    const meshes: THREE.Mesh[] = [];
    for (let i = 0; i < colors.length; i += 1) {
      const geo = new THREE.TorusGeometry(span * 0.38 + i * 0.08, 0.045, 5, 20, Math.PI * 0.62);
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i],
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData['bb'] = 1;
      this.host.scene.add(mesh);
      this.own.push(mesh);
      meshes.push(mesh);
    }
    const face = Math.hypot(origin.faceX, origin.faceZ) || 1;
    this.actors.push({
      kind: 'arc',
      age: 0,
      life: 1.05,
      x: origin.cloudX,
      z: origin.cloudZ,
      meshes,
      acc: 0,
      span,
      faceX: origin.faceX / face,
      faceZ: origin.faceZ / face,
    });
    this.host.label(origin.cloudX, 2.5, origin.cloudZ, 'RAINBOW');
    return true;
  }

  private spawnSit(state: SaveState, origin: CastOrigin, tag: Sit['tag']): boolean {
    const spot = state.driestNear(origin.cloudX, origin.cloudZ, tag === 'purify' ? 1 : 0.4, 10) ?? {
      x: origin.cloudX,
      z: origin.cloudZ,
    };
    const mesh = this.sprite(this.host.baby, tag === 'purify' ? 0.9 : 0.7, tag === 'purify' ? 0.7 : 0.5, tag === 'purify' ? '#d8ffc4' : '#b6f7a4');
    if (!mesh) return false;
    this.host.scene.add(mesh);
    this.own.push(mesh);
    const drops = this.takeMany(tag === 'purify' ? '#d4ffb0' : '#c8f7a8', 4);
    this.actors.push({
      kind: 'sit',
      tag,
      age: 0,
      life: tag === 'purify' ? 1.15 : 1.35,
      x: spot.x,
      z: spot.z,
      mesh,
      drops,
      acc: 0,
      done: false,
    });
    this.host.label(spot.x, 2.1, spot.z, tag === 'purify' ? 'PURIFY' : 'SPORE');
    return true;
  }

  private step(actor: Actor, dt: number, cloudX: number, cloudZ: number, state: SaveState | null): boolean {
    switch (actor.kind) {
      case 'sprinkler':
        return this.stepSprinkler(actor, dt, cloudX, cloudZ, state);
      case 'bolt':
        return this.stepBolt(actor, state);
      case 'spout':
        return this.stepSpout(actor, dt, state);
      case 'drone':
        return this.stepDrone(actor, dt, cloudX, cloudZ, state);
      case 'geyser':
        return this.stepGeyser(actor, state);
      case 'bomb':
        return this.stepBomb(actor, state);
      case 'sheet':
        return this.stepSheet(actor, dt, state);
      case 'hail':
        return this.stepHail(actor, state);
      case 'arc':
        return this.stepArc(actor, dt, state);
      case 'sit':
        return this.stepSit(actor, dt, state);
      default:
        return true;
    }
  }

  private stepSprinkler(actor: Sprinkler, dt: number, cloudX: number, cloudZ: number, state: SaveState | null): boolean {
    actor.x = cloudX;
    actor.z = cloudZ;
    const t = Math.min(1, actor.age / actor.life);
    const spin = actor.age * 4.6;
    const alt = this.host.cloudLift();
    const open = Math.min(1, actor.age / 0.4);
    const radius = Math.max(5.4, actor.reach * 2.2) * (0.9 + 0.1 * Math.sin(open * Math.PI * 0.5));
    const paintR = Math.max(1.15, actor.reach * 0.85);
    const per = Math.max(1, Math.floor(actor.drops.length / actor.jets));
    actor.drops.forEach((drop, i) => {
      const jet = Math.floor(i / per);
      const along = (i % per) / per;
      const ang = spin + (jet / actor.jets) * Math.PI * 2;
      const r = radius * (0.2 + along * 0.85);
      const falling = Math.max(0, (along - 0.72) / 0.28);
      const lift = alt * (0.78 + Math.sin(along * Math.PI) * 0.48) * (1 - falling) + 0.35 * falling;
      this.host.place(drop, actor.x + Math.cos(ang) * r, actor.z + Math.sin(ang) * r, lift);
      drop.scale.setScalar(3.1 + (1 - along) * 0.7);
      drop.renderOrder = 4;
      (drop.material as THREE.MeshBasicMaterial).depthTest = false;
    });
    actor.acc += dt;
    if (state && actor.acc >= 0.28 && t > 0.15 && t < 0.92) {
      actor.acc = 0;
      const ang = spin;
      const x = actor.x + Math.cos(ang) * paintR;
      const z = actor.z + Math.sin(ang) * paintR;
      state.burst(x, z, 0.32, 1);
    }
    return actor.age >= actor.life;
  }

  private stepBolt(actor: Bolt, state: SaveState | null): boolean {
    if (actor.age < actor.delay) {
      actor.mesh.visible = false;
      return false;
    }
    actor.mesh.visible = true;
    const local = actor.age - actor.delay;
    const grow = Math.min(1, local / 0.12);
    actor.mesh.scale.set(1, grow, 1);
    this.host.place(actor.mesh, actor.x, actor.z, 2.8);
    if (!actor.hit && local > 0.1 && state) {
      actor.hit = true;
      state.burst(actor.x, actor.z, 0.5, actor.limit);
      state.boostStageInRadius(actor.x, actor.z, 0.62, 1);
      state.stampWaveAt(actor.x, actor.z, 1.15);
      this.host.shake(0.38);
      this.host.zap();
      this.host.spark(actor.x, 1.2, actor.z, 8);
      this.splash(actor.x, actor.z, '#e7f6ff', 0.7);
    }
    const mat = actor.mesh.material as THREE.ShaderMaterial;
    mat.uniforms['uFade']!.value = Math.max(0, 1 - Math.max(0, local - 0.18) / 0.32);
    return actor.age >= actor.life;
  }

  private stepSpout(actor: Spout, dt: number, state: SaveState | null): boolean {
    actor.retarget -= dt;
    if (state && actor.retarget <= 0) {
      actor.retarget = 0.85;
      const next = state.driestNear(actor.x, actor.z, 0.9, 9);
      if (next) {
        actor.tx = next.x;
        actor.tz = next.z;
      }
    }
    const moved = approach(actor.x, actor.z, actor.tx, actor.tz, 3.3, dt);
    actor.x = moved.x;
    actor.z = moved.z;
    if (!moved.arrived) {
      const dx = actor.tx - actor.x;
      const dz = actor.tz - actor.z;
      const mag = Math.hypot(dx, dz) || 1;
      actor.vx = dx / mag;
      actor.vz = dz / mag;
    } else {
      actor.x += actor.vx * 3.3 * dt;
      actor.z += actor.vz * 3.3 * dt;
    }
    this.host.place(actor.mesh, actor.x, actor.z, 0.85);
    actor.mesh.rotation.z += dt * 6;
    actor.acc += dt;
    if (state && actor.acc >= 0.26) {
      actor.acc = 0;
      const hit = state.burst(actor.x, actor.z, 0.48, 1);
      state.stampWaveAt(actor.x, actor.z, 0.7);
      if (hit.filled > 0) this.host.spark(actor.x, 0.8, actor.z, 4);
    }
    return actor.age >= actor.life;
  }

  private stepDrone(actor: Drone, dt: number, cloudX: number, cloudZ: number, state: SaveState | null): boolean {
    if (actor.phase === 'out') {
      const moved = approach(actor.x, actor.z, actor.tx, actor.tz, 4.6, dt);
      actor.x = moved.x;
      actor.z = moved.z;
      if (moved.arrived) actor.phase = 'rain';
    } else if (actor.phase === 'rain') {
      actor.hold += dt;
      if (actor.hold > 1.7) actor.phase = 'home';
      actor.acc += dt;
      if (state && actor.acc >= 0.22) {
        actor.acc = 0;
        state.paintPatch(actor.x, actor.z, 0.42, state.soakAmount() * 1.6, false);
      }
    } else {
      const moved = approach(actor.x, actor.z, cloudX, cloudZ, 5.2, dt);
      actor.x = moved.x;
      actor.z = moved.z;
      if (moved.arrived || actor.age > 7) return true;
    }
    const bob = Math.sin(actor.age * 6) * 0.08;
    this.host.place(actor.mesh, actor.x, actor.z, 2.15 + bob);
    const raining = actor.phase === 'rain';
    actor.drops.forEach((drop, i) => {
      drop.visible = raining;
      if (!raining) return;
      const fall = (actor.age * 3 + i * 0.25) % 1;
      this.host.place(drop, actor.x + (i - 1.5) * 0.12, actor.z, 1.7 * (1 - fall));
      drop.scale.setScalar(0.65);
    });
    return false;
  }

  private stepGeyser(actor: Geyser, state: SaveState | null): boolean {
    const bulge = actor.drops[0];
    if (bulge && actor.age < 0.38) {
      const s = 0.4 + (actor.age / 0.38) * 1.8;
      bulge.scale.setScalar(s);
      this.host.place(bulge, actor.x, actor.z, 0.12 * s);
      for (let i = 1; i < actor.drops.length; i += 1) {
        const drop = actor.drops[i];
        if (drop) drop.visible = false;
      }
    } else {
      if (!actor.popped && state) {
        actor.popped = true;
        state.burst(actor.x, actor.z, actor.radius, actor.limit);
        state.stampWaveAt(actor.x, actor.z, 1.3);
        this.host.shake(0.28);
        this.host.spark(actor.x, 0.8, actor.z, 8);
        this.splash(actor.x, actor.z, '#c6ecff', actor.radius);
      }
      actor.drops.forEach((drop, i) => {
        drop.visible = true;
        const launch = Math.max(0, actor.age - 0.32);
        const y = Math.max(0.15, launch * (3.4 + i * 0.15) - i * 0.08);
        const spread = Math.sin(launch * 5 + i) * 0.12 * i;
        drop.scale.setScalar(i === 0 ? 2.1 : 1.45);
        this.host.place(drop, actor.x + spread, actor.z + spread * 0.4, y * 1.35);
      });
    }
    return actor.age >= actor.life;
  }

  private stepBomb(actor: Bomb, state: SaveState | null): boolean {
    const t = Math.min(1, actor.age / actor.life);
    const x = actor.x0 + (actor.x1 - actor.x0) * t;
    const z = actor.z0 + (actor.z1 - actor.z0) * t;
    const lift = Math.sin(t * Math.PI) * 3.1 + 0.4;
    actor.mesh.scale.setScalar(2.4 - t * 0.3);
    this.host.place(actor.mesh, x, z, lift);
    if (t >= 1 && !actor.boomed && state) {
      actor.boomed = true;
      state.burst(actor.x1, actor.z1, actor.radius, actor.limit);
      state.stampWaveAt(actor.x1, actor.z1, 1.8);
      this.host.shake(0.48);
      this.host.spark(actor.x1, 0.7, actor.z1, 12);
      this.splash(actor.x1, actor.z1, '#b7e6ff', actor.radius);
      actor.mesh.visible = false;
    }
    return actor.age >= actor.life + 0.05;
  }

  private stepSheet(actor: Sheet, dt: number, state: SaveState | null): boolean {
    actor.x += actor.dx * actor.speed * dt;
    actor.z += actor.dz * actor.speed * dt;
    const px = -actor.dz;
    const pz = actor.dx;
    actor.drops.forEach((drop, i) => {
      const u = actor.drops.length <= 1 ? 0 : i / (actor.drops.length - 1) - 0.5;
      const bob = Math.sin(actor.age * 7 + i) * 0.12;
      drop.scale.setScalar(actor.tag === 'monsoon' ? 1.15 : 1.45);
      this.host.place(drop, actor.x + px * actor.width * u, actor.z + pz * actor.width * u, 0.35 + bob + (i % 3) * 0.18);
    });
    actor.acc += dt;
    if (state && !actor.soaked && actor.acc >= 0.2) {
      actor.acc = 0;
      const samples = actor.tag === 'tide' ? 3 : 2;
      for (let s = 0; s < samples; s += 1) {
        const u = s / (samples - 1) - 0.5;
        state.burst(actor.x + px * actor.width * u, actor.z + pz * actor.width * u, 0.4, 1);
      }
    }
    return actor.age >= actor.life;
  }

  private stepHail(actor: Hail, state: SaveState | null): boolean {
    actor.drops.forEach((drop, i) => {
      const fall = Math.min(1, actor.age / 0.55 + i * 0.02);
      const spread = (i - actor.drops.length / 2) * 0.16;
      drop.scale.setScalar(0.55 + (1 - fall) * 0.4);
      this.host.place(drop, actor.x + spread, actor.z + (i % 2) * 0.12, 2.8 * (1 - fall) + 0.15);
    });
    if (!actor.hit && actor.age > 0.5 && state) {
      actor.hit = true;
      state.burst(actor.x, actor.z, 0.55, actor.limit);
      state.boostStageInRadius(actor.x, actor.z, 0.6, 1);
      state.stampWaveAt(actor.x, actor.z, 0.9);
      this.host.spark(actor.x, 0.5, actor.z, 6);
    }
    return actor.age >= actor.life;
  }

  private stepArc(actor: Arc, dt: number, state: SaveState | null): boolean {
    actor.meshes.forEach((mesh, i) => {
      const fade = 1 - Math.max(0, actor.age - 0.45) / 0.6;
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.82 * fade);
      this.host.place(mesh, actor.x, actor.z, 1.35 + i * 0.06);
    });
    actor.acc += dt;
    if (state && actor.acc >= 0.16 && actor.age < 0.7) {
      actor.acc = 0;
      const t = actor.age / 0.7;
      const ang = (t - 0.5) * Math.PI * 0.8;
      const ox = actor.x + actor.faceX * actor.span * 0.25 + Math.cos(ang) * actor.span * 0.35;
      const oz = actor.z + actor.faceZ * actor.span * 0.25 + Math.sin(ang) * actor.span * 0.28;
      state.paintPatch(ox, oz, actor.span * 0.22, state.soakAmount() * 1.4, false);
    }
    return actor.age >= actor.life;
  }

  private stepSit(actor: Sit, dt: number, state: SaveState | null): boolean {
    const bob = Math.sin(actor.age * 5) * 0.06;
    this.host.place(actor.mesh, actor.x, actor.z, 1.7 + bob);
    actor.drops.forEach((drop, i) => {
      const fall = (actor.age * 2.6 + i * 0.22) % 1;
      this.host.place(drop, actor.x + (i - 1.5) * 0.1, actor.z, 1.4 * (1 - fall));
      drop.scale.setScalar(0.6);
    });
    actor.acc += dt;
    if (state && actor.acc >= 0.24) {
      actor.acc = 0;
      if (actor.tag === 'spore') {
        state.paintPatch(actor.x, actor.z, 0.5, state.soakAmount() * 1.3, false);
      } else if (!actor.done) {
        actor.done = true;
        state.burst(actor.x, actor.z, 0.7, 5);
        state.boostStageInRadius(actor.x, actor.z, 0.85, 2);
        state.stampWaveAt(actor.x, actor.z, 1.1);
        this.splash(actor.x, actor.z, '#d9ffc2', 0.7);
      }
    }
    if (state && actor.tag === 'spore' && actor.age >= actor.life - dt) {
      state.boostMossBand(actor.x, actor.z, 0.7, 0.14);
    }
    return actor.age >= actor.life;
  }

  private stepSplashes(dt: number): void {
    for (let i = this.splashes.length - 1; i >= 0; i -= 1) {
      const splash = this.splashes[i];
      if (!splash) continue;
      splash.life -= dt;
      const t = 1 - Math.max(0, splash.life) / 0.55;
      const mat = splash.mesh.material as THREE.MeshBasicMaterial;
      if (splash.life <= 0) {
        this.host.scene.remove(splash.mesh);
        splash.mesh.geometry.dispose();
        mat.dispose();
        this.splashes.splice(i, 1);
        continue;
      }
      splash.mesh.scale.setScalar(1 + t * 1.4);
      mat.opacity = 0.8 * (splash.life / 0.55);
    }
  }

  private splash(x: number, z: number, color: string, radius: number): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.35, radius, 22),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    this.host.scene.add(mesh);
    this.host.place(mesh, x, z, 0.08);
    this.splashes.push({ mesh, life: 0.55 });
  }

  private take(color: string): THREE.Mesh | null {
    const mesh = this.pool.find((item) => !this.held.has(item));
    if (!mesh) return null;
    this.held.add(mesh);
    mesh.visible = true;
    mesh.scale.set(1, 1, 1);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(color);
    mat.opacity = 1;
    return mesh;
  }

  private takeMany(color: string, count: number): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = this.take(color);
      if (!mesh) break;
      out.push(mesh);
    }
    return out;
  }

  private give(mesh: THREE.Mesh): void {
    mesh.visible = false;
    mesh.scale.set(1, 1, 1);
    mesh.renderOrder = 0;
    (mesh.material as THREE.MeshBasicMaterial).depthTest = true;
    this.held.delete(mesh);
  }

  private giveAll(meshes: THREE.Mesh[]): void {
    for (const mesh of meshes) this.give(mesh);
  }

  private sprite(map: THREE.Texture, w: number, h: number, color: string): THREE.Mesh | null {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map,
        color,
        transparent: true,
        alphaTest: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.userData['bb'] = 1;
    return mesh;
  }

  private release(actor: Actor): void {
    const drops =
      'drops' in actor ? actor.drops : actor.kind === 'bomb' ? [actor.mesh] : [];
    for (const mesh of drops) {
      if (this.held.has(mesh)) this.give(mesh);
    }
    const custom: THREE.Object3D[] = [];
    if (actor.kind === 'bolt' || actor.kind === 'spout' || actor.kind === 'drone' || actor.kind === 'sit') {
      custom.push(actor.mesh);
    }
    if (actor.kind === 'arc') custom.push(...actor.meshes);
    for (const mesh of custom) {
      this.host.scene.remove(mesh);
      const at = this.own.indexOf(mesh);
      if (at >= 0) this.own.splice(at, 1);
      const geo = (mesh as THREE.Mesh).geometry;
      const mat = (mesh as THREE.Mesh).material;
      geo?.dispose();
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  }
}

function boltMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uFade: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying vec2 vUv;
      void main() {
        float edge = abs(vUv.x - 0.5) * 2.0;
        float core = 1.0 - smoothstep(0.0, 0.45, edge);
        float glow = 1.0 - smoothstep(0.2, 1.0, edge);
        vec3 col = mix(vec3(0.55, 0.85, 1.0), vec3(1.0), core);
        gl_FragColor = vec4(col, (core * 0.95 + glow * 0.45) * uFade);
      }
    `,
  });
}
