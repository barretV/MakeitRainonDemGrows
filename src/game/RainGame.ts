import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLOBE_WORLD, TILE, gridOf, worldDef } from './balance';
import { Terrain } from './terrain';
import { getArt, type ArtSet, type CloudMood } from './pixels';
import { BASE_SCALE, maskOf, upgradeNode, type NodeId, type Ranks } from './tree';
import { AudioBus } from './audio';
import { clearProgress, readProgress, writeProgress } from './save';
import type { PetalId } from './petal';
import { SaveState, formatDew, walletDew, type HudModel, type SoakResult } from './state';

function formatSplashDew(n: number): string {
  return formatDew(walletDew(n));
}
import { bridge } from './bridge';

/** MashKin-style board camera: pitched down over a flat XZ slab, slight yaw so billboards have a face. */
const YAW = -0.38;
const PITCH = 0.72;
const MOVE = 6.4;
/** World units per pixel of finger travel. Same idea as Chimney Fisher's relative drag: the press is an anchor, not a teleport. */
const STEER = 0.042;
/** 1 = default framing (closest). Larger values pull the camera back. */
const CAM_ZOOM_MIN = 1;
const CAM_ZOOM_MAX = 1.85;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

function growPullForScale(scale: number): number {
  return Math.pow(Math.max(BASE_SCALE, scale) / BASE_SCALE, 0.62);
}

const TiltShiftShader = {
  name: 'TiltShift',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uFocus: { value: 0.34 },
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    varying vec2 vUv;
    void main() {
      float amt = smoothstep(0.84, 0.99, vUv.y);
      vec4 col = vec4(0.0);
      float wsum = 0.0;
      for (int i = -4; i <= 4; i++) {
        float w = 1.0 - abs(float(i)) / 5.0;
        vec2 off = vec2(float(i) * 0.7, float(i) * 1.1) * uTexel * (amt * 4.0);
        col += texture2D(tDiffuse, vUv + off) * w;
        wsum += w;
      }
      col /= wsum;
      vec2 vigUv = (vUv - 0.5) * vec2(1.1, 1.2);
      float vig = smoothstep(0.98, 0.32, length(vigUv));
      col.rgb *= mix(0.82, 1.0, vig);
      gl_FragColor = col;
    }
  `,
};

const TILE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TILE_FRAG = /* glsl */ `
  uniform sampler2D uDead;
  uniform sampler2D uLive;
  uniform sampler2D uMask;
  uniform vec2 uTileOrigin;
  uniform vec2 uTileSize;
  uniform vec2 uMaskSize;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 muv = clamp(uTileOrigin + vUv * uTileSize, 0.001, 0.999);
    vec4 m = texture2D(uMask, muv);
    float wet = m.r;
    float rip = m.g;
    vec2 local = fract(muv * uMaskSize) - 0.5;
    float d = length(local) * 2.0;
    float soak = smoothstep(0.03, 0.2, wet);
    float moss = smoothstep(0.18, 0.42, wet);
    float grass = smoothstep(0.38, 0.65, wet);
    float bloom = smoothstep(0.58, 0.9, wet);
    float grown = smoothstep(0.82, 0.98, wet);
    vec2 uv = fract(vUv * 2.0);
    vec3 dead = texture2D(uDead, uv).rgb;
    vec3 live = texture2D(uLive, uv).rgb;
    vec3 damp = mix(dead, dead * vec3(0.48, 0.76, 1.1), soak);
    float cell = fract(sin(dot(floor(muv * uMaskSize), vec2(12.9898, 78.233))) * 43758.5453);
    damp = mix(damp, vec3(0.42, 0.32, 0.22), moss * 0.55);
    damp = mix(damp, vec3(0.38, 0.72, 0.32), step(0.72, cell) * grass * (1.0 - bloom));
    float glisten = step(0.9, fract(cell * 5.0 + uTime * 0.4)) * wet * (1.0 - grass);
    damp += vec3(0.7, 0.92, 1.0) * glisten;
    vec3 col = mix(damp, live, grass * 0.85 + grown * 0.35);
    col = mix(col, live, grown);
    float edge = smoothstep(0.22, 0.0, abs(d - rip * 1.25)) * rip;
    col += vec3(1.0, 0.96, 0.7) * edge * (0.5 + soak * 0.4);
    col += vec3(1.0, 0.9, 0.55) * bloom * (0.06 + 0.04 * sin(uTime * 2.6 + muv.x * 48.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface TileView {
  mat: THREE.ShaderMaterial;
  prop: THREE.Mesh | null;
  pond: THREE.Mesh | null;
  koi: THREE.Mesh | null;
  bar: THREE.Mesh | null;
  ripple: number;
  dressed: boolean;
  anim: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

interface Floater {
  mesh: THREE.Mesh;
  life: number;
  vy: number;
}

interface Mote {
  mesh: THREE.Mesh;
  life: number;
  vx: number;
  vy: number;
  vz: number;
}

interface Drop {
  mesh: THREE.Mesh;
  y: number;
  vy: number;
  alive: boolean;
}

interface Critter {
  mesh: THREE.Mesh;
  tile: number;
  cool: number;
  phase: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
}

interface SkyBird {
  mesh: THREE.Mesh;
  phase: number;
  radius: number;
  height: number;
  speed: number;
}

interface Stick {
  id: number;
  x: number;
  y: number;
  cx: number;
  cz: number;
}

export class RainGame {
  readonly audio = new AudioBus();
  private readonly onHud: (model: HudModel) => void;
  private readonly container: HTMLDivElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly tilt: ShaderPass;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly keys = new Set<string>();
  private readonly art: ArtSet;
  private readonly timeU = { value: 0 };
  private state: SaveState | null = null;
  private dead = false;
  private skipSave = false;
  private frame = 0;
  private hudAcc = 0;
  private lastPhase: 'play' | 'dry' | 'clear' = 'play';
  private saveAcc = 0;
  private soakAcc = 0;
  private dropAcc = 0;
  private babyAcc = 2;
  private keyRain = false;
  private mouseRain = false;
  private stick: Stick | null = null;
  private cloudX = 0;
  private cloudZ = 0;
  private prevX = 0;
  private prevZ = 0;
  private camX = 0;
  private camZ = 0;
  private faceX = 1;
  private faceZ = 0;
  private slosh = 0;
  private shake = 0;
  private cloudPop = 1;
  private toastAge = 0;
  private lastToast = '';
  private spin = 0;
  private mood: CloudMood = 'idle';
  private grin = 0;
  private hoverY = 2;
  private camGroundY = 1;
  private camZoom = 1;
  private camZoomPulse = 0;
  /** Smoothed follow distance multiplier as Cloud Puff grows (1 = day-one size). */
  private camGrowPull = 1;
  private workshopSnap: { scale: number; reach: number } | null = null;
  private introActive = false;
  private introT = 0;
  private introDuration = 0;
  private introScaleFrom = 1;
  private introPullFrom = 1;
  private introPullTo = 1;
  private skyLift = 0;
  private readonly skyBase = new THREE.Color();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchSpan0 = 0;
  private pinchZoom0 = 1;
  private maskTex: THREE.DataTexture | null = null;
  private terrain: Terrain | null = null;
  private maskMats: THREE.ShaderMaterial[] = [];
  private globe = false;
  private track = new THREE.Group();
  private views: TileView[] = [];
  private cloud: THREE.Mesh;
  private curtain: THREE.Mesh;
  private puddle: THREE.Mesh;
  private mountain: THREE.Mesh;
  private peaks: THREE.Mesh[] = [];
  private hillsBackdrop: THREE.Mesh;
  private shafts: THREE.Mesh[] = [];
  private puffs: THREE.Mesh[] = [];
  private puffDrift: number[] = [];
  private birds: SkyBird[] = [];
  private farTrees: THREE.Mesh[] = [];
  private animals: Critter[] = [];
  private helpers: THREE.Mesh[] = [];
  private boxes: THREE.Mesh[] = [];
  private butterflies: THREE.Mesh[] = [];
  private babies: Array<{ mesh: THREE.Mesh; x: number; z: number }> = [];
  private tornado: { mesh: THREE.Mesh; x: number; z: number; life: number; acc: number } | null = null;
  private bolts: Array<{ mesh: THREE.Mesh; life: number }> = [];
  private rings: Array<{ mesh: THREE.Mesh; life: number }> = [];
  private texts: Floater[] = [];
  private motes: Mote[] = [];
  private drops: Drop[] = [];
  private readonly resizeObserver: ResizeObserver;

  constructor(container: HTMLDivElement, onHud: (model: HudModel) => void) {
    this.container = container;
    this.onHud = onHud;
    this.art = getArt();
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.domElement.className = 'stage-canvas';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.35, 420);
    this.scene.background = new THREE.Color('#f7c6df');
    this.scene.fog = new THREE.Fog('#f7c6df', 24, 52);
    this.scene.add(this.track);
    this.scene.add(this.camera);

    this.mountain = this.billboard(this.art.mountain, 15, 9.2, 0.12);
    this.scene.add(this.mountain);
    for (let i = 0; i < 2; i += 1) {
      const peak = this.billboard(this.art.mountain, 11, 7.5, 0.12);
      peak.scale.setScalar(0.72 + i * 0.12);
      this.peaks.push(peak);
      this.scene.add(peak);
    }

    const puff = document.createElement('canvas');
    puff.width = 128;
    puff.height = 64;
    const puffCtx = puff.getContext('2d');
    if (puffCtx) {
      puffCtx.fillStyle = 'rgba(255,255,255,0.92)';
      puffCtx.beginPath();
      puffCtx.ellipse(64, 36, 48, 18, 0, 0, Math.PI * 2);
      puffCtx.ellipse(40, 40, 28, 16, 0, 0, Math.PI * 2);
      puffCtx.ellipse(92, 38, 26, 14, 0, 0, Math.PI * 2);
      puffCtx.fill();
    }
    const puffTex = new THREE.CanvasTexture(puff);
    puffTex.colorSpace = THREE.SRGBColorSpace;
    puffTex.magFilter = THREE.LinearFilter;
    puffTex.minFilter = THREE.LinearFilter;
    for (let i = 0; i < 8; i += 1) {
      const mesh = this.billboard(puffTex, 5.6 + (i % 3) * 0.8, 2.4 + (i % 2) * 0.35, 0.04);
      const puffMat = mesh.material as THREE.MeshBasicMaterial;
      puffMat.depthWrite = false;
      puffMat.fog = false;
      puffMat.opacity = 0.82 + (i % 3) * 0.06;
      puffMat.transparent = true;
      this.puffs.push(mesh);
      this.puffDrift.push(i * 1.7);
      this.scene.add(mesh);
    }

    const shaftTex = this.glowTexture('shaft');
    for (let i = 0; i < 4; i += 1) {
      const shaft = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2 + i * 0.5, 16),
        new THREE.MeshBasicMaterial({
          map: shaftTex,
          color: 0xfff0c8,
          transparent: true,
          opacity: 0.1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
      );
      shaft.renderOrder = 2;
      shaft.userData['bb'] = 1;
      shaft.userData['shaftBase'] = 0.08;
      shaft.userData['shaftAmp'] = 0.05;
      this.shafts.push(shaft);
      this.scene.add(shaft);
    }

    this.hillsBackdrop = this.billboard(this.art.hills[0]!, 44, 12, 0.06);
    const hillMat = this.hillsBackdrop.material as THREE.MeshBasicMaterial;
    hillMat.fog = true;
    hillMat.transparent = true;
    this.hillsBackdrop.userData['bb'] = 1;
    this.scene.add(this.hillsBackdrop);

    for (let i = 0; i < 4; i += 1) {
      const mesh = this.billboard(this.art.bird, 0.55, 0.32, 0.12);
      const birdMat = mesh.material as THREE.MeshBasicMaterial;
      birdMat.fog = false;
      mesh.renderOrder = 8;
      mesh.userData['bb'] = 1;
      this.scene.add(mesh);
      this.birds.push({
        mesh,
        phase: i * 1.6,
        radius: 14 + i * 3.5,
        height: 11 + i * 1.2,
        speed: 0.22 + i * 0.04,
      });
    }

    for (let i = 0; i < 8; i += 1) {
      const mesh = this.billboard(this.art.deadTree[0]!, 1.5, 2.1, 0.2);
      this.farTrees.push(mesh);
      this.scene.add(mesh);
    }

    this.cloud = this.billboard(this.art.cloud.idle, 4.6, 3.0, 0.12);
    const cloudMat = this.cloud.material as THREE.MeshBasicMaterial;
    cloudMat.fog = false;
    cloudMat.toneMapped = false;
    this.cloud.renderOrder = 25;
    this.scene.add(this.cloud);
    this.curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        uniforms: {
          uTime: { value: 0 },
          uTop: { value: 0.45 },
          uDensity: { value: 0.55 },
          uSilver: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uTop;
          uniform float uDensity;
          uniform float uSilver;
          varying vec2 vUv;
          float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main() {
            float hw = mix(0.5, max(0.12, uTop) * 0.5, vUv.y);
            float x = (vUv.x - 0.5) / max(hw, 0.001);
            if (abs(x) > 1.0) discard;
            float core = 1.0 - x * x;
            float body = pow(core, 0.65);
            float colX = floor((x * 0.5 + 0.5) * 28.0);
            float speed = 1.8 + h(vec2(colX, 1.0)) * 1.8;
            float s = fract(vUv.y * 4.2 + uTime * speed + h(vec2(colX, 2.0)));
            float streak = smoothstep(0.0, 0.04, s) * smoothstep(0.42, 0.1, s) * step(0.28, uDensity + h(vec2(colX, 3.0)) * 0.5);
            vec2 cell = floor(vec2((x * 0.5 + 0.5) * 22.0, vUv.y * 48.0 + uTime * 8.0));
            float spark = step(0.9, h(cell));
            float fade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
            vec3 cool = mix(vec3(0.35, 0.82, 1.0), vec3(0.82, 0.98, 1.0), body);
            vec3 silver = mix(vec3(0.72, 0.88, 1.0), vec3(0.95, 0.98, 1.0), body);
            vec3 col = mix(cool, silver, uSilver);
            col = mix(col, vec3(1.0), spark);
            float alpha = (0.42 * body + streak * 0.55 + spark * 0.85) * fade;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    );
    this.curtain.userData['bb'] = 1;
    this.curtain.renderOrder = 3;
    this.curtain.visible = false;
    this.scene.add(this.curtain);

    this.puddle = new THREE.Mesh(
      new THREE.CircleGeometry(1, 28),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {},
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float d = length(p);
            float fill = smoothstep(1.0, 0.15, d) * 0.22;
            float rim = smoothstep(1.0, 0.86, d) * smoothstep(0.72, 0.86, d);
            if (fill + rim < 0.02) discard;
            vec3 col = mix(vec3(0.45, 0.95, 0.62), vec3(0.7, 0.92, 1.0), rim);
            gl_FragColor = vec4(col, fill + rim * 0.65);
          }
        `,
      }),
    );
    this.puddle.rotation.x = -Math.PI / 2;
    this.puddle.visible = false;
    this.scene.add(this.puddle);

    this.seedPools();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.tilt = new ShaderPass(TiltShiftShader);
    this.composer.addPass(this.tilt);
    this.composer.addPass(new OutputPass());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);

    bridge.onPause = this.saveBridge;
    bridge.onQuit = this.saveBridge;
    this.placeCamera(0);
    void this.boot();
  }

  dispose(): void {
    this.dead = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    this.audio.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    el.remove();
    if (bridge.onPause === this.saveBridge) {
      bridge.onPause = () => {};
      bridge.onQuit = () => {};
    }
  }

  retry(): void {
    if (!this.state) return;
    this.state.retryRun();
    this.rebuild();
    this.dropCloud(this.spawnAt());
    this.pushHud(true);
  }

  /** Workshop → rain: cinematic grow + camera pull when power changed. */
  returnFromWorkshop(): void {
    if (!this.state) return;
    const snap = this.workshopSnap;
    const oldScale = snap?.scale ?? this.state.scale();
    const oldReach = snap?.reach ?? this.state.reach();
    this.state.retryRun();
    this.rebuild();
    this.dropCloud(this.spawnAt());
    const newScale = this.state.scale();
    const newReach = this.state.reach();
    const puffGrew = newScale > oldScale * 1.008;
    const reachGrew = newReach > oldReach * 1.04;
    if (puffGrew || reachGrew) {
      this.beginWorkshopIntro(oldScale, newScale, oldReach, newReach, puffGrew);
    } else if (snap) {
      this.beginWorkshopIntro(oldScale, newScale, oldReach, newReach, false);
    }
    this.workshopSnap = null;
    this.pushHud(true);
  }

  private beginWorkshopIntro(
    oldScale: number,
    newScale: number,
    oldReach: number,
    newReach: number,
    major: boolean,
  ): void {
    this.introActive = true;
    this.introT = 0;
    this.introDuration = major ? 1.45 : 0.85;
    this.introScaleFrom = Math.min(1, oldScale / Math.max(newScale, 0.001));
    this.introPullFrom = growPullForScale(oldScale);
    this.introPullTo = growPullForScale(newScale);
    if (newReach > oldReach * 1.02) {
      this.introPullTo *= 1 + Math.min(0.12, (newReach - oldReach) / Math.max(oldReach, 0.5) * 0.08);
    }
    this.camGrowPull = this.introPullFrom;
    this.cloudPop = major ? 0.62 : 0.88;
    this.camZoom = 1;
    this.shake = major ? 0.18 : 0.08;
    this.grin = major ? 0.5 : 0.25;
    this.audio.chime();
    if (this.state) {
      this.state.toast = major ? 'You grew!' : 'Power up!';
    }
  }

  advance(): void {
    if (!this.state || this.state.phase !== 'clear') return;
    this.goto(this.state.world + 1);
  }

  openWorkshop(): void {
    if (this.state) {
      this.workshopSnap = { scale: this.state.scale(), reach: this.state.reach() };
    }
    this.state?.openWorkshop();
    this.pushHud(true);
  }

  openWorlds(): void {
    this.state?.openWorlds();
    this.pushHud(true);
  }

  showResults(): void {
    this.state?.showResults();
    this.pushHud(true);
  }

  getRanks(): Ranks | null {
    return this.state ? { ...this.state.ranks } : null;
  }

  buy(id: NodeId): boolean {
    if (!this.state) return false;
    const node = upgradeNode(id);
    const gateUnlock = node.kind === 'gate' && this.state.ranks[id] === 0;
    if (!this.state.buy(id)) {
      this.pushHud(true);
      return false;
    }
    this.audio.coin();
    this.cloudPop = id === 'puff' ? 1.28 : 1.18;
    this.setCamZoom(this.camZoom * 0.93);
    this.camZoomPulse = 0.45;
    if (gateUnlock) this.shake = 0.3;
    void this.saveNow();
    this.pushHud(true);
    return true;
  }

  buyPetal(id: PetalId): void {
    if (!this.state) return;
    if (!this.state.buyPetal(id)) this.state.toast = 'Need more blooms for that.';
    else {
      this.audio.chime();
      this.cloudPop = 1.14;
      void this.saveNow();
    }
    this.pushHud(true);
  }

  cast(which: 'lightning' | 'tornado'): void {
    if (!this.state) return;
    if (which === 'lightning') {
      if (!this.state.armLightning()) return;
      const hit = this.state.burst(this.cloudX, this.cloudZ, this.state.reach() * 0.62, 18 + this.state.ranks.zap * 12);
      this.audio.zap();
      this.shake = 0.4;
      this.flashBolt(this.nearestTile());
      if (hit.filled > 0) this.grin = 0.6;
    } else if (this.state.startTornado()) {
      this.spawnTornado();
      this.audio.zap();
    }
    this.pushHud(true);
  }

  goto(world: number): void {
    if (!this.state) return;
    if (!this.state.goto(world)) {
      this.pushHud(true);
      return;
    }
    this.rebuild();
    this.dropCloud(this.spawnAt());
    this.pushHud(true);
  }

  toggleSfx(): void {
    if (!this.state) return;
    this.state.sfx = !this.state.sfx;
    this.audio.setMuted(!this.state.sfx);
    this.pushHud(true);
  }

  toggleMusic(): void {
    if (!this.state) return;
    this.audio.toggleMusic();
    this.state.music = this.audio.musicOn;
    if (this.audio.musicOn && !this.state.toast) {
      this.state.toast = 'Placeholder loop is on. Swap in your track whenever.';
    }
    this.pushHud(true);
  }

  async reset(): Promise<void> {
    await clearProgress();
    this.state = SaveState.fresh();
    this.audio.setMuted(!this.state.sfx);
    this.rebuild();
    this.dropCloud(this.spawnAt());
    this.pushHud(true);
  }

  private saveBridge = (): void => {
    void this.saveNow();
  };

  private async boot(): Promise<void> {
    const fresh = new URLSearchParams(window.location.search).has('fresh');
    if (fresh) await clearProgress();
    const raw = fresh ? null : await readProgress();
    if (this.dead) return;
    const loaded = raw ? SaveState.fromJSON(raw) : null;
    this.state = loaded ?? SaveState.fresh();
    this.skipSave = false;
    if (fresh) await this.saveNow();
    this.lastPhase = this.state.phase;
    this.audio.setMuted(!this.state.sfx);
    if (this.state.music) this.audio.toggleMusic();
    this.rebuild();
    this.dropCloud(this.spawnAt());
    this.pushHud(true);
    this.frame = requestAnimationFrame(this.loop);
  }

  private loop = (): void => {
    if (this.dead) return;
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (!this.state) {
      this.composer.render();
      return;
    }
    this.simulate(dt);
    this.animate(dt);
    this.composer.render();
    this.hudAcc += dt;
    this.saveAcc += dt;
    if (this.hudAcc > 0.12) {
      this.hudAcc = 0;
      this.pushHud(false);
    }
    if (this.saveAcc > 5) {
      this.saveAcc = 0;
      void this.saveNow();
    }
  };

  private simulate(dt: number): void {
    const state = this.state;
    if (!state) return;
    if (state.phase !== 'play') {
      this.audio.rainStop();
      return;
    }
    if (this.introActive) {
      this.audio.rainStop();
      return;
    }
    const { cols, rows } = gridOf(state.world);
    const minXZ = -TILE / 2 + 0.3;
    const maxX = cols * TILE - TILE / 2 - 0.3;
    const maxZ = rows * TILE - TILE / 2 - 0.3;
    const fwd = (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) - (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0);
    const strafe = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    if (fwd !== 0 || strafe !== 0) {
      const len = Math.hypot(fwd, strafe);
      if (this.globe) {
        const turn = 0.7 * dt;
        this.cloudZ = clamp(this.cloudZ + (fwd / len) * turn, -1.15, 1.15);
        this.cloudX += (strafe / len) * turn;
        this.faceX = strafe / len;
        this.faceZ = fwd / len;
      } else {
        const rightX = Math.cos(YAW);
        const rightZ = -Math.sin(YAW);
        const fwdX = -Math.sin(YAW);
        const fwdZ = -Math.cos(YAW);
        const mx = (strafe * rightX + fwd * fwdX) / len;
        const mz = (strafe * rightZ + fwd * fwdZ) / len;
        this.cloudX = clamp(this.cloudX + mx * MOVE * dt, minXZ, maxX);
        this.cloudZ = clamp(this.cloudZ + mz * MOVE * dt, minXZ, maxZ);
        this.faceX = mx;
        this.faceZ = mz;
      }
      if (this.stick) {
        this.stick.cx = this.cloudX;
        this.stick.cz = this.cloudZ;
      }
    }
    const speed = Math.hypot(this.cloudX - this.prevX, this.cloudZ - this.prevZ) / Math.max(dt, 0.001);
    this.slosh += (clamp((this.cloudX - this.prevX) * 14, -1, 1) - this.slosh) * Math.min(1, dt * 4);
    this.prevX = this.cloudX;
    this.prevZ = this.cloudZ;

    const held = this.wantsRain();
    const raining = held && state.tank > 0.008;
    state.tick(dt, { raining: held, moving: speed > 0.4 });
    if (state.phase !== this.lastPhase) {
      if (state.phase !== 'play') {
        this.pushHud(true);
        void this.saveNow();
      }
      this.lastPhase = state.phase;
    }
    if (raining && !this.audio.muted) {
      this.audio.rainStart();
      this.audio.setRainHum(state.petals.hum >= 1);
    } else {
      this.audio.rainStop();
    }

    this.soakAcc += dt;
    let splashDew = 0;
    let splashCrits = 0;
    while (this.soakAcc >= 0.1) {
      this.soakAcc -= 0.1;
      if (!raining) continue;
      const hit = state.drizzle(this.cloudX, this.cloudZ);
      splashDew += hit.dew;
      splashCrits += hit.crits;
      if (hit.filled > 0) this.grin = 0.75;
    }
    if (splashDew >= 0.05) {
      const label =
        splashCrits > 0
          ? `CRIT +${formatSplashDew(splashDew)}`
          : `+${formatSplashDew(splashDew)}`;
      this.floatText(this.cloud.position.x, this.cloud.position.y + 0.45, label, splashCrits > 0);
    }

    if (raining && state.armLightning()) {
      const hit = state.burst(this.cloudX, this.cloudZ, state.reach() * 0.62, 18 + state.ranks.zap * 12);
      this.audio.zap();
      this.shake = 0.4;
      this.flashBolt(this.nearestTile());
      if (hit.filled > 0) this.grin = 0.6;
    }
    if (raining && !this.tornado && state.tornadoCd <= 0 && state.startTornado()) {
      this.spawnTornado();
      this.audio.zap();
    }

    if (raining && state.trySpin()) {
      this.spin = 0.48;
      state.burst(this.cloudX, this.cloudZ, state.reach() * (1.05 + state.ranks.spin * 0.22), 14 + state.ranks.spin * 8);
      this.burst(this.cloudX, 1.3, this.cloudZ, 10);
      this.grin = 0.4;
    }

    this.babyAcc -= dt;
    if (this.babyAcc <= 0) {
      this.babyAcc = 8 + Math.random() * 7;
      this.spawnBaby();
    }
    for (const baby of this.babies) {
      baby.x += (this.cloudX - baby.x) * Math.min(1, dt * 0.55);
      baby.z += (this.cloudZ - baby.z) * Math.min(1, dt * 0.55);
      baby.mesh.position.set(baby.x, 2.5 + Math.sin(this.clock.elapsedTime * 3 + baby.x) * 0.08, baby.z);
      if (Math.hypot(baby.x - this.cloudX, baby.z - this.cloudZ) < 0.85) baby.mesh.visible = false;
    }
    this.babies = this.babies.filter((b) => b.mesh.visible);

    if (this.tornado) {
      this.tornado.life -= dt;
      this.tornado.x += this.faceX * 4.2 * dt;
      this.tornado.z += this.faceZ * 4.2 * dt;
      this.tornado.mesh.position.set(this.tornado.x, 1.05, this.tornado.z);
      this.tornado.mesh.rotation.z += dt * 8;
      this.tornado.acc += dt;
      if (this.tornado.acc >= 0.12) {
        this.tornado.acc = 0;
        const spun = state.burst(this.tornado.x, this.tornado.z, 0.85 + state.ranks.twist * 0.28, 5 + state.ranks.twist * 3);
        if (spun.filled > 0) this.grin = 0.35;
      }
      const outside = this.tornado.x < -2 || this.tornado.z < -2 || this.tornado.x > maxX + 2 || this.tornado.z > maxZ + 2;
      if (this.tornado.life <= 0 || outside) {
        this.scene.remove(this.tornado.mesh);
        this.tornado = null;
      }
    }

    if (state.toast !== this.lastToast) {
      this.lastToast = state.toast;
      this.toastAge = 0;
      const t = state.toast.toLowerCase();
      if (t.includes('revival') || t.includes('whole again')) this.skyLift = 2.6;
    } else if (state.toast) {
      this.toastAge += dt;
      if (this.toastAge > 3.2) {
        state.toast = '';
        this.lastToast = '';
      }
    }

  }

  private animate(dt: number): void {
    const state = this.state;
    if (!state) return;
    const t = this.clock.elapsedTime;
    this.timeU.value = t;
    const vx = this.cloudX - this.cloud.position.x;
    const vz = this.cloudZ - this.cloud.position.z;
    const lean = -(vx * Math.cos(YAW) - vz * Math.sin(YAW));
    const sleepy = state.tank <= 0.01;
    const raining = this.wantsRain() && !sleepy && !this.introActive;
    const blink = Math.sin(t * 0.65) > 0.965;
    const mood: CloudMood = sleepy
      ? 'sleep'
      : this.grin > 0
        ? 'grin'
        : state.tank < 0.25
          ? 'pout'
          : blink
            ? 'blink'
            : raining
              ? 'joy'
              : 'idle';
    this.grin = Math.max(0, this.grin - dt);
    const mat = this.cloud.material as THREE.MeshBasicMaterial;
    if (mood !== this.mood) {
      mat.map = this.art.cloud[mood];
      mat.needsUpdate = true;
      this.mood = mood;
    }
    const bow = state.petals.bow >= 1;
    mat.color.set(sleepy ? '#c5c9d4' : bow ? '#fff4fc' : '#ffffff');
    let grown = state.scale();
    if (this.introActive) {
      this.introT += dt;
      const raw = Math.min(1, this.introT / this.introDuration);
      const scaleU = easeOutBack(raw);
      grown *= this.introScaleFrom + (1 - this.introScaleFrom) * scaleU;
      this.camGrowPull = this.introPullFrom + (this.introPullTo - this.introPullFrom) * easeOutCubic(raw);
      this.cloudPop += (1.12 - this.cloudPop) * Math.min(1, dt * (raw < 0.85 ? 2.2 : 6));
      if (raw >= 1) {
        this.introActive = false;
        this.camGrowPull = this.introPullTo;
        this.cloudPop = 1.08;
      }
    } else {
      this.cloudPop += (1 - this.cloudPop) * Math.min(1, dt * 7);
    }
    const speed = Math.hypot(vx, vz) / Math.max(dt, 0.016);
    const stretch = 1 + Math.min(0.2, speed * 0.012);
    const blush = state.petals.blush >= 1 ? 1.06 : 1;
    const cheek =
      (raining ? 1 + Math.sin(t * 9) * 0.05 : 1 + Math.sin(t * 2.1) * 0.025) * blush;
    const pop = this.cloudPop;
    this.cloud.scale.set(
      (grown * cheek * pop) / Math.sqrt(stretch),
      grown * cheek * stretch * pop,
      grown * cheek * pop,
    );
    const bob = Math.sin(t * 2.5) * 0.08;
    if (this.globe) {
      const hover = this.lonLatPoint(this.cloudX, this.cloudZ, 6.85 + 1.2 * grown);
      this.cloud.position.set(hover.x, hover.y + bob, hover.z);
    } else {
      const gy = this.groundY(this.cloudX, this.cloudZ);
      const glide = 1 - Math.exp(-dt * 3.2);
      const lift = 1 - Math.exp(-dt * 1.35);
      this.cloud.position.x += (this.cloudX - this.cloud.position.x) * glide;
      this.cloud.position.z += (this.cloudZ - this.cloud.position.z) * glide;
      const targetY = gy + 1.35 + 2.1 * grown;
      this.hoverY += (targetY - this.hoverY) * lift;
      this.camGroundY += (gy - this.camGroundY) * (1 - Math.exp(-dt * 2.4));
      this.cloud.position.y = this.hoverY + bob;
    }
    this.spin = Math.max(0, this.spin - dt);
    const twirl = this.spin > 0 ? (1 - this.spin / 0.48) * Math.PI * 2 : 0;
    this.cloud.userData['roll'] = clamp(lean * 0.7, -0.28, 0.28) + twirl;

    const curtainMat = this.curtain.material as THREE.ShaderMaterial;
    curtainMat.uniforms['uTime']!.value = t;
    curtainMat.uniforms['uSilver']!.value = state.petals.trail >= 1 ? 1 : 0;
    this.curtain.visible = raining;
    this.puddle.visible = raining;
    if (raining) {
      const reach = state.reach();
      const ground = this.globe ? this.cloud.position.y - 1.2 * grown - 0.4 : this.hoverY - 1.35 - 0.55 * grown;
      const cloudBase = this.cloud.position.y - 0.45 * grown;
      const tall = Math.max(0.4, cloudBase - ground);
      const wide = Math.max(reach * 2.8, 3.4 * grown);
      const mat = this.curtain.material as THREE.ShaderMaterial;
      mat.uniforms['uTop']!.value = Math.min(1, (2.0 * grown) / wide);
      mat.uniforms['uDensity']!.value = Math.min(0.75, state.patch() + 0.15);
      this.curtain.scale.set(wide, tall, 1);
      this.curtain.position.set(this.cloud.position.x, ground + tall / 2, this.cloud.position.z);
      this.puddle.position.set(this.cloud.position.x, ground + 0.04, this.cloud.position.z);
      this.puddle.scale.setScalar(reach * (1 + Math.sin(t * 8) * 0.03));
    }

    this.placeCamera(dt);
    this.dressSky(t);

    this.dropAcc += dt;
    if (raining && this.dropAcc > state.dropEvery() * 0.5) {
      this.dropAcc = 0;
      const specks = 2 + Math.floor(state.ranks.specks / 2);
      for (let i = 0; i < specks; i += 1) this.launchDrop();
    }
    for (const drop of this.drops) {
      if (!drop.alive) continue;
      drop.y -= drop.vy * dt;
      drop.mesh.position.y = drop.y;
      const floor = this.globe ? 0.2 : this.groundY(drop.mesh.position.x, drop.mesh.position.z) + 0.05;
      if (drop.y < floor) drop.alive = drop.mesh.visible = false;
    }

    state.fadeRipples(dt);
    if (state.maskDirty || !this.maskTex || (this.wantsRain() && state.phase === 'play' && state.tank > 0.01)) this.syncMask();
    for (const index of state.takeGreen()) {
      this.onBloom(index, { dew: 0, bloomed: true, crit: false, pond: state.spec(index).kind === 'pond', mega: state.spec(index).kind === 'seed', filling: null });
    }
    for (let i = 0; i < this.views.length; i += 1) {
      const view = this.views[i];
      if (!view) continue;
      if (view.anim > 0) view.anim = Math.max(0, view.anim - dt / 0.45);
      if (view.prop) {
        const base = Number(view.prop.userData['s']) || 1;
        const s = base * (1 + Math.sin(view.anim * Math.PI) * 0.28);
        view.prop.scale.setScalar(s);
        const lift = (Number(view.prop.userData['ph']) || 1) * s * 0.5;
        view.prop.position.set(view.x + view.nx * lift, view.y + view.ny * lift, view.z + view.nz * lift);
      }
    }

    this.applySkyLift(dt);
    this.faceAll();
    this.syncProps(t);
    this.syncCritters(dt, t);
    this.stepFx(dt);
  }

  private applySkyLift(dt: number): void {
    if (this.skyLift <= 0 || this.globe) return;
    this.skyLift = Math.max(0, this.skyLift - dt);
    const lift = (this.skyLift / 2.6) * 0.22;
    const bg = this.scene.background as THREE.Color;
    const fog = this.scene.fog as THREE.Fog | null;
    bg.r = clamp(this.skyBase.r + lift, 0, 1);
    bg.g = clamp(this.skyBase.g + lift * 0.9, 0, 1);
    bg.b = clamp(this.skyBase.b + lift * 0.55, 0, 1);
    if (fog) fog.color.copy(bg);
  }

  private rebuild(): void {
    const state = this.state;
    if (!state) return;
    this.animals = [];
    this.boxes = [];
    this.clearGroup(this.track);
    this.views = [];
    if (this.tornado) {
      this.scene.remove(this.tornado.mesh);
      this.tornado = null;
    }
    const art = this.art;
    const world = state.world;
    this.globe = world === GLOBE_WORLD;
    this.camZoom = 1;
    const sky = this.globe ? '#24356e' : worldDef(world).skyMid;
    this.scene.background = this.globe ? new THREE.Color(sky) : (art.skies[world] ?? new THREE.Color(sky));
    this.skyBase.copy(this.scene.background as THREE.Color);
    const dist = this.frameDist(0);
    this.scene.fog = this.globe ? new THREE.Fog(sky, 18, 48) : new THREE.Fog(sky, dist * 1.05, dist * 2.65);
    this.mountain.visible = false;
    for (const peak of this.peaks) peak.visible = false;
    this.hillsBackdrop.visible = !this.globe;
    for (const tree of this.farTrees) tree.visible = !this.globe;
    const hillTex = this.art.hills[world] ?? this.art.hills[0]!;
    (this.hillsBackdrop.material as THREE.MeshBasicMaterial).map = hillTex;
    const tint = ['#f0d0e0', '#d8ecff', '#f5e6c8', '#e0d4f0'][world] ?? '#e8dce8';
    (this.hillsBackdrop.material as THREE.MeshBasicMaterial).color.set(tint);

    const { cols, rows } = gridOf(world);
    const spanX = (cols - 1) * TILE;
    const spanZ = (rows - 1) * TILE;
    if (this.globe) {
      const sea = new THREE.Mesh(
        new THREE.SphereGeometry(6.35, 36, 24),
        new THREE.MeshBasicMaterial({ color: '#7ec8f0' }),
      );
      this.track.add(sea);
    }

    const dead = art.deadTop[world] ?? art.deadTop[0]!;
    const live = art.liveTop[world] ?? art.liveTop[0]!;
    const maskSize = maskOf(world);
    this.maskTex = this.makeMask(state.pixels, maskSize.cols, maskSize.rows);
    this.maskMats = [];
    this.terrain = null;
    let voxelMat: THREE.ShaderMaterial | null = null;
    const terrain = new Terrain(world);
    this.terrain = terrain;
    const fog = this.scene.fog as THREE.Fog;
    const ground = terrain.buildMesh(this.maskTex, maskSize, this.timeU, fog);
    voxelMat = ground.material as THREE.ShaderMaterial;
    this.maskMats.push(voxelMat);
    this.track.add(ground);
    if (!this.globe) {
      const flora = terrain.buildFlora(art.flora, this.maskTex, maskSize, this.timeU, fog);
      this.maskMats.push(flora.material as THREE.ShaderMaterial);
      this.track.add(flora);
    }
    const tiles = state.current();
    for (let i = 0; i < tiles.length; i += 1) {
      const spec = state.spec(i);
      const at = this.tilePos(i);
      const restored = state.isRestored(i);
      const col = i % cols;
      const row = Math.floor(i / cols);
      if (voxelMat) {
        const view: TileView = {
          mat: voxelMat,
          prop: null,
          pond: null,
          koi: null,
          bar: null,
          ripple: restored ? 1 : -1,
          dressed: restored,
          anim: 0,
          x: at.x,
          y: at.y,
          z: at.z,
          nx: 0,
          ny: 1,
          nz: 0,
        };
        if (this.globe) {
          const len = Math.hypot(at.x, at.y, at.z) || 1;
          view.nx = at.x / len;
          view.ny = at.y / len;
          view.nz = at.z / len;
        }
        this.dressView(view, i, restored, world);
        continue;
      }
      const column = spec.height * 0.46;
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uDead: { value: dead },
          uLive: { value: live },
          uMask: { value: this.maskTex },
          uTileOrigin: { value: new THREE.Vector2(col / cols, row / rows) },
          uTileSize: { value: new THREE.Vector2(1 / cols, 1 / rows) },
          uMaskSize: { value: new THREE.Vector2(maskSize.cols, maskSize.rows) },
          uTime: this.timeU,
        },
        vertexShader: TILE_VERT,
        fragmentShader: TILE_FRAG,
      });
      const geo = new THREE.BoxGeometry(this.globe ? 0.78 : TILE * 1.02, Math.max(0.28, column), this.globe ? 0.78 : TILE * 1.02);
      geo.translate(0, Math.max(0.28, column) / 2, 0);
      const side = new THREE.MeshBasicMaterial({
        map: (restored ? art.liveCliff[world] : art.deadCliff[world]) ?? art.deadCliff[0],
      });
      const mesh = new THREE.Mesh(geo, [side, side, mat, side, side, side]);
      const normal = this.globe ? new THREE.Vector3(at.x, at.y, at.z).normalize() : new THREE.Vector3(0, 1, 0);
      mesh.position.set(at.x, this.globe ? at.y : 0, at.z);
      if (this.globe) mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      this.track.add(mesh);
      const view: TileView = {
        mat,
        prop: null,
        pond: null,
        koi: null,
        bar: null,
        ripple: restored ? 1 : -1,
        dressed: restored,
        anim: 0,
        x: at.x,
        y: this.globe ? at.y : column,
        z: at.z,
        nx: normal.x,
        ny: normal.y,
        nz: normal.z,
      };
      this.dressView(view, i, restored, world);
    }
    const backX = -Math.sin(YAW);
    const backZ = -Math.cos(YAW);
    const rightX = Math.cos(YAW);
    const rightZ = -Math.sin(YAW);
    const boardX = spanX / 2;
    const boardZ = spanZ / 2;
    const span = Math.max(spanX, spanZ);
    this.hillsBackdrop.position.set(boardX + backX * span * 0.62, 0.35, boardZ + backZ * span * 0.62);
    this.hillsBackdrop.scale.set(span * 1.05, span * 0.32, 1);
    this.farTrees.forEach((tree, i) => {
      const along = (i - 3.5) * 2.8;
      const liveTree = state.ratio() > 0.12 && i % 2 === 0;
      const map = liveTree ? (art.liveTree[world] ?? art.liveTree[0]) : (art.deadTree[world] ?? art.deadTree[0]);
      (tree.material as THREE.MeshBasicMaterial).map = map ?? null;
      tree.position.set(boardX + backX * span * 0.58 + rightX * along, 0.55, boardZ + backZ * span * 0.58 + rightZ * along);
    });

    this.syncBoxes(true);
    this.syncCritters(0, 0, true);
  }

  private dressView(view: TileView, index: number, restored: boolean, world: number): void {
    const state = this.state;
    if (!state) return;
    const art = this.art;
    const spec = state.spec(index);
    if (spec.kind === 'pond') {
      view.pond = this.billboard(restored ? art.pondFull : art.pondEmpty, 1.15, 0.62, 0.25);
      view.pond.position.set(view.x + view.nx * 0.35, view.y + view.ny * 0.35, view.z + view.nz * 0.35);
      this.track.add(view.pond);
      view.bar = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.07), new THREE.MeshBasicMaterial({ color: '#7ec8f0' }));
      view.bar.position.set(view.x + view.nx * 0.9, view.y + view.ny * 0.9, view.z + view.nz * 0.9);
      view.bar.userData['bb'] = 1;
      this.track.add(view.bar);
    }
    const flat = !this.globe;
    const wet = state.hillWet(index);
    view.prop =
      spec.kind === 'seed'
        ? this.billboard(restored ? art.money : art.seed, 1.15, 1.7, 0.2)
        : flat && spec.decor === 'twig'
          ? null
          : this.propMesh(spec.decor, restored, world);
    if (view.prop) {
      const offIsland = flat && this.terrain && this.terrain.shoreAt(view.x, view.z) > 0.06;
      view.prop.visible = !offIsland && (restored || wet > 0.14 || spec.kind === 'seed');
      if (flat) {
        const jx = (((index * 37) % 11) / 11 - 0.5) * TILE * 0.5;
        const jz = (((index * 53) % 13) / 13 - 0.5) * TILE * 0.5;
        view.x += jx;
        view.z += jz;
        view.y = this.groundY(view.x, view.z);
        if (spec.decor === 'tree') {
          view.prop.userData['s'] = 1.25 + ((index * 7) % 5) * 0.08;
          view.prop.scale.setScalar(view.prop.userData['s'] as number);
        }
      }
      const ph = (Number(view.prop.userData['ph']) || 1) * view.prop.scale.y;
      view.prop.position.set(view.x + view.nx * (ph / 2), view.y + view.ny * (ph / 2), view.z + view.nz * (ph / 2));
      this.track.add(view.prop);
    }
    if (restored && spec.kind === 'seed' && view.prop) view.prop.userData['s'] = 1.25;
    this.views.push(view);
  }

  private dressTile(index: number): void {
    const state = this.state;
    const view = this.views[index];
    if (!state || !view || view.dressed) return;
    const spec = state.spec(index);
    const world = state.world;
    const art = this.art;
    view.dressed = true;
    view.anim = 1;
    if (view.pond) (view.pond.material as THREE.MeshBasicMaterial).map = art.pondFull;
    if (view.bar) view.bar.visible = false;
    if (view.prop) {
      const map = spec.kind === 'seed' ? art.money : this.propTexture(spec.decor, true, world, false);
      (view.prop.material as THREE.MeshBasicMaterial).map = map;
      if (spec.kind === 'seed') view.prop.userData['s'] = 1.25;
    }
    if (spec.kind === 'pond' && !view.koi) {
      view.koi = this.billboard(art.koi, 0.62, 0.38, 0.2);
      view.koi.position.set(view.x + 0.12, 0.55, view.z);
      this.track.add(view.koi);
    }
    if (view.koi) view.koi.visible = spec.kind === 'pond';
  }

  private onBloom(index: number, result: SoakResult): void {
    const view = this.views[index];
    if (view && !view.dressed) this.dressTile(index);
    const at = view ? { x: view.x, z: view.z } : this.tilePos(index);
    this.rippleAt(at.x, at.z, result.mega ? '#ffe56a' : result.pond ? '#7ec8f0' : '#ffd0e4');
    this.burst(at.x, 0.7, at.z, result.mega ? 22 : 14);
    if (this.state && this.state.petals.sparkle >= 1) this.burst(at.x, 0.85, at.z, 8);
    if (result.dew > 0) {
      this.floatText(at.x, 1.35, result.crit ? `CRIT +${Math.floor(result.dew)}` : `+${Math.floor(result.dew)}`, result.crit);
    }
    if (result.pond) {
      this.audio.splash();
      this.leapKoi(index);
    } else if (result.bloomed) this.audio.bloom();
    if (result.mega) this.shake = 0.55;
    this.syncCritters(0, 0, true);
  }

  private syncProps(t: number): void {
    const state = this.state;
    if (!state) return;
    this.syncBoxes(false);
    for (let i = 0; i < this.views.length; i += 1) {
      const view = this.views[i];
      const tile = state.current()[i];
      if (!view || !tile) continue;
      const spec = state.spec(i);
      if (view.bar && spec.kind === 'pond' && !state.isRestored(i)) {
        view.bar.scale.x = Math.max(0.05, tile.pond);
        view.bar.visible = tile.pond < 1;
      }
      const wet = state.hillWet(i);
      const restored = state.isRestored(i);
      if (view.prop && spec.kind !== 'seed') {
        view.prop.visible = restored || wet > 0.14;
        if (view.prop.visible) {
          const live = restored || wet > 0.68;
          const map =
            spec.kind === 'pond'
              ? null
              : this.propTexture(spec.decor, live, state.world, false);
          if (map) (view.prop.material as THREE.MeshBasicMaterial).map = map;
          const base = Number(view.prop.userData['s']) || 1;
          const pop = restored ? 1 : clamp(0.32 + wet * 0.78, 0.32, 0.96);
          view.prop.scale.setScalar(base * pop);
        }
      }
      if (view.prop && restored) {
        view.prop.rotation.z = Math.sin(t * 1.6 + i) * 0.05;
      } else if (view.prop) view.prop.rotation.z *= 0.9;
      if (view.koi) view.koi.position.y = 0.48 + Math.abs(Math.sin(t * 3 + i)) * 0.22;
    }
  }

  private syncBoxes(force: boolean): void {
    const state = this.state;
    if (!state) return;
    const indexes = state.boomboxIndexes();
    if (!force && this.boxes.length === indexes.length) {
      indexes.forEach((i, n) => {
        const mesh = this.boxes[n];
        const view = this.views[i];
        if (!mesh || !view) return;
        mesh.position.set(view.x + view.nx * 1.05, view.y + view.ny * 1.05, view.z + view.nz * 1.05);
      });
      return;
    }
    for (const mesh of this.boxes) this.track.remove(mesh);
    this.boxes = indexes.map((i) => {
      const mesh = this.billboard(this.art.boombox, 0.85, 1.15, 0.2);
      const view = this.views[i];
      mesh.position.set((view?.x ?? 0) + (view?.nx ?? 0), (view?.y ?? 1) + (view?.ny ?? 1), (view?.z ?? 0) + (view?.nz ?? 0));
      this.track.add(mesh);
      return mesh;
    });
  }

  private syncCritters(dt: number, t: number, rebuild = false): void {
    const state = this.state;
    if (!state) return;
    const want = state.animalCount();
    if (rebuild || this.animals.length !== want) {
      for (const animal of this.animals) this.track.remove(animal.mesh);
      const spots = this.restoredSpots();
      const map = [this.art.frog, this.art.fox, this.art.fennec, this.art.duck][state.world] ?? this.art.frog;
      this.animals = [];
      for (let i = 0; i < want; i += 1) {
        const mesh = this.billboard(map, 0.62, 0.52, 0.2);
        mesh.userData['pet'] = i;
        const spot = spots[i % Math.max(1, spots.length)] ?? 0;
        const view = this.views[spot];
        const sx = view?.x ?? 0;
        const sz = view?.z ?? 0;
        this.track.add(mesh);
        this.animals.push({
          mesh,
          tile: spot,
          cool: 0,
          phase: Math.random() * 6,
          x: sx,
          z: sz,
          tx: sx,
          tz: sz,
        });
      }
    }
    const spots = this.restoredSpots();
    const ratio = state.ratio();
    for (const animal of this.animals) {
      animal.cool = Math.max(0, animal.cool - dt);
      if (ratio < 0.06) {
        const view = this.views[animal.tile];
        const hop = 0.35 + Math.abs(Math.sin(t * 5 + animal.phase)) * 0.1;
        if (view) {
          animal.mesh.position.set(view.x + view.nx * hop, view.y + view.ny * hop, view.z + view.nz * hop);
        }
        continue;
      }
      if (Math.hypot(animal.x - animal.tx, animal.z - animal.tz) < 0.35 || animal.cool <= 0) {
        const next = spots[Math.floor(Math.random() * Math.max(1, spots.length))] ?? animal.tile;
        const view = this.views[next];
        if (view) {
          animal.tx = view.x;
          animal.tz = view.z;
          animal.tile = next;
          animal.cool = 1.8 + Math.random() * 2.4;
        }
      }
      const step = (0.85 + ratio * 1.4) * dt;
      animal.x += (animal.tx - animal.x) * Math.min(1, step);
      animal.z += (animal.tz - animal.z) * Math.min(1, step);
      const gy = this.groundY(animal.x, animal.z);
      const hop = Math.abs(Math.sin(t * 6 + animal.phase)) * 0.12;
      animal.mesh.position.set(animal.x, gy + 0.35 + hop, animal.z);
    }

    const helpers = state.helperCount();
    if (this.helpers.length !== helpers) {
      for (const mesh of this.helpers) this.scene.remove(mesh);
      this.helpers = [];
      for (let i = 0; i < helpers; i += 1) {
        const mesh = this.billboard(this.art.baby, 0.7, 0.46, 0.15);
        this.scene.add(mesh);
        this.helpers.push(mesh);
      }
    }
    this.helpers.forEach((mesh, i) => {
      const spot = spots[(i * 3) % Math.max(1, spots.length)] ?? 0;
      const view = this.views[spot];
      mesh.position.set(view?.x ?? 0, 2.15 + Math.sin(t * 1.4 + i) * 0.08, view?.z ?? 0);
    });

    const flies = state.ratio() > 0.25 ? 5 : 0;
    if (this.butterflies.length !== flies) {
      for (const mesh of this.butterflies) this.scene.remove(mesh);
      this.butterflies = [];
      for (let i = 0; i < flies; i += 1) {
        const mesh = this.billboard(this.art.butterfly, 0.32, 0.26, 0.12);
        this.scene.add(mesh);
        this.butterflies.push(mesh);
      }
    }
    this.butterflies.forEach((mesh, i) => {
      const spot = spots[(i * 2 + 1) % Math.max(1, spots.length)] ?? 0;
      const view = this.views[spot];
      mesh.position.set((view?.x ?? 0) + Math.sin(t + i) * 0.45, 1.05 + Math.cos(t * 1.3 + i) * 0.16, view?.z ?? 0);
    });
  }

  private stepFx(dt: number): void {
    for (const text of this.texts) {
      if (text.life <= 0) continue;
      text.life -= dt;
      text.mesh.position.y += text.vy * dt;
      text.mesh.scale.setScalar(1 + (1 - Math.max(text.life, 0)) * 0.35);
      (text.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, text.life);
      text.mesh.visible = text.life > 0;
    }
    for (const mote of this.motes) {
      if (mote.life <= 0) continue;
      mote.life -= dt;
      mote.mesh.position.x += mote.vx * dt;
      mote.mesh.position.y += mote.vy * dt;
      mote.mesh.position.z += mote.vz * dt;
      mote.vy -= dt * 1.4;
      mote.mesh.rotation.z += dt * 4;
      (mote.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, mote.life);
      mote.mesh.visible = mote.life > 0;
    }
    for (const bolt of this.bolts) {
      bolt.life -= dt;
      bolt.mesh.scale.x = 1 + (0.25 - bolt.life) * 4;
      (bolt.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, bolt.life * 4);
      if (bolt.life <= 0) this.scene.remove(bolt.mesh);
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const ring of this.rings) {
      ring.life -= dt;
      const s = 1 + (1 - ring.life) * 14;
      ring.mesh.scale.setScalar(s);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ring.life);
      if (ring.life <= 0) this.scene.remove(ring.mesh);
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  private onDown = (event: PointerEvent): void => {
    this.audio.unlock();
    const state = this.state;
    if (!state) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size >= 2) {
      this.pinchSpan0 = this.pointerSpan();
      this.pinchZoom0 = this.camZoom;
      this.stick = null;
    }
    this.aim(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.animals.map((a) => a.mesh), false);
    const first = hits[0];
    if (first && event.button === 0) {
      const index = Number(first.object.userData['pet']);
      const animal = this.animals[index];
      if (animal && animal.cool <= 0) {
        animal.cool = 8;
        const dew = state.pet();
        this.audio.chime();
        this.floatText(animal.mesh.position.x, animal.mesh.position.y + 0.45, `+${Math.floor(dew)}`, false);
        const heart = this.takeMote(this.art.heart);
        if (heart) {
          heart.mesh.position.copy(animal.mesh.position);
          heart.life = 0.8;
          heart.vy = 0.8;
          heart.vx = 0;
          heart.vz = 0;
        }
        return;
      }
    }
    const touch = event.pointerType === 'touch' || event.pointerType === 'pen';
    if (touch && this.pointers.size < 2) {
      this.stick = { id: event.pointerId, x: event.clientX, y: event.clientY, cx: this.cloudX, cz: this.cloudZ };
      this.renderer.domElement.setPointerCapture(event.pointerId);
    } else if (event.button === 0) {
      this.mouseRain = true;
    }
  };

  private onUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchSpan0 = 0;
    if (this.stick && event.pointerId === this.stick.id) this.stick = null;
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') this.mouseRain = false;
  };

  private onWheel = (event: WheelEvent): void => {
    if (!this.state || this.state.phase !== 'play') return;
    event.preventDefault();
    const step = 0.0016;
    const delta = event.deltaY * step;
    this.setCamZoom(this.camZoom * (1 + delta));
  };

  private onMove = (event: PointerEvent): void => {
    if (this.pointers.has(event.pointerId)) {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (this.pointers.size >= 2 && this.pinchSpan0 > 0) {
      const span = this.pointerSpan();
      if (span > 6) this.setCamZoom(this.pinchZoom0 * (span / this.pinchSpan0));
      return;
    }
    if (!this.stick || event.pointerId !== this.stick.id || !this.state || this.state.phase !== 'play') return;
    if (this.globe) {
      const dx = event.clientX - this.stick.x;
      const dy = event.clientY - this.stick.y;
      this.cloudX = this.stick.cx + dx * 0.005;
      this.cloudZ = clamp(this.stick.cz - dy * 0.004, -1.15, 1.15);
      return;
    }
    const { cols, rows } = gridOf(this.state.world);
    const dx = event.clientX - this.stick.x;
    const dy = event.clientY - this.stick.y;
    const rightX = Math.cos(YAW);
    const rightZ = -Math.sin(YAW);
    const fwdX = -Math.sin(YAW);
    const fwdZ = -Math.cos(YAW);
    const wx = (dx * rightX - dy * fwdX) * STEER;
    const wz = (dx * rightZ - dy * fwdZ) * STEER;
    const nextX = clamp(this.stick.cx + wx, -TILE / 2 + 0.3, cols * TILE - TILE / 2 - 0.3);
    const nextZ = clamp(this.stick.cz + wz, -TILE / 2 + 0.3, rows * TILE - TILE / 2 - 0.3);
    if (Math.hypot(wx, wz) > 0.2) {
      this.faceX = wx;
      this.faceZ = wz;
    }
    this.cloudX = nextX;
    this.cloudZ = nextZ;
  };

  private onKey = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'spacebar' || key.startsWith('arrow')) event.preventDefault();
    this.keys.add(key);
    if (event.repeat) return;
    if (key === ' ' || key === 'spacebar') {
      this.keyRain = true;
      this.audio.unlock();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    this.keys.delete(key);
    if (key === ' ' || key === 'spacebar') this.keyRain = false;
  };

  private aim(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private wantsRain(): boolean {
    return this.keyRain || this.mouseRain || (this.stick !== null && this.pointers.size < 2);
  }

  private pointerSpan(): number {
    const pts = [...this.pointers.values()];
    const a = pts[0];
    const b = pts[1];
    if (!a || !b) return 0;
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  private setCamZoom(next: number): void {
    this.camZoom = clamp(next, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
  }

  private placeCamera(dt: number): void {
    if (this.camZoomPulse > 0 && dt > 0) {
      this.camZoomPulse = Math.max(0, this.camZoomPulse - dt);
      this.camZoom += (1 - this.camZoom) * Math.min(1, dt * 5.5);
    }
    const k = dt <= 0 ? 1 : 1 - Math.exp(-dt * 3.2);
    this.camX += (this.cloudX - this.camX) * k;
    this.camZ += (this.cloudZ - this.camZ) * k;
    this.shake *= Math.exp(-Math.max(dt, 0) * 3.5);
    const jx = (Math.random() - 0.5) * this.shake;
    const jy = (Math.random() - 0.5) * this.shake;
    const dist = this.frameDist(dt) * this.camZoom;
    if (this.globe) {
      const a = this.lonLatPoint(this.camX, this.camZ, 6.85);
      const n = Math.hypot(a.x, a.y, a.z) || 1;
      const pull = n + dist;
      this.camera.position.set((a.x / n) * pull + jx, (a.y / n) * pull + 1.1 + jy, (a.z / n) * pull);
      this.camera.lookAt(a.x, a.y, a.z);
      return;
    }
    const gy = this.camGroundY;
    if (this.terrain) {
      const boardX = this.terrain.originX + this.terrain.width * 0.5;
      const boardZ = this.terrain.originZ + this.terrain.depth * 0.5;
      const span = Math.min(this.terrain.width, this.terrain.depth);
      const panX = (this.camX - boardX) * 0.35;
      const panZ = (this.camZ - boardZ) * 0.35;
      const pull = this.cameraGrowPull(dt);
      const lift = span * 0.72 * this.camZoom * pull;
      const back = span * 0.78 * this.camZoom * pull;
      this.camera.position.set(boardX + panX + jx, 2.2 + lift + jy, boardZ + panZ + back);
      this.camera.lookAt(boardX + panX * 0.4, 1.6, boardZ + panZ * 0.2);
      return;
    }
    this.camera.position.set(
      this.camX + Math.sin(YAW) * Math.cos(PITCH) * dist + jx,
      gy + Math.sin(PITCH) * dist * 0.72 + jy,
      this.camZ + Math.cos(YAW) * Math.cos(PITCH) * dist,
    );
    this.camera.lookAt(this.camX + jx * 0.2, gy + 0.35, this.camZ);
  }

  private makeMask(data: Uint8Array, cols: number, rows: number): THREE.DataTexture {
    const tex = new THREE.DataTexture(data as never, cols, rows, THREE.RGBAFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;
    tex.needsUpdate = true;
    return tex;
  }

  private syncMask(): void {
    const state = this.state;
    if (!state) return;
    const { cols, rows } = maskOf(state.world);
    if (!this.maskTex || this.maskTex.image.width !== cols || this.maskTex.image.height !== rows) {
      this.maskTex = this.makeMask(state.pixels, cols, rows);
      for (const mat of this.maskMats) mat.uniforms['uMask']!.value = this.maskTex;
    } else {
      (this.maskTex.image as { data: Uint8Array }).data = state.pixels;
    }
    this.maskTex.needsUpdate = true;
    state.maskDirty = false;
  }

  /** Camera pull-back vs puff size; lerps so upgrades feel like stepping back. */
  private cameraGrowPull(dt: number): number {
    if (this.introActive) return this.camGrowPull;
    const scale = Math.max(BASE_SCALE, this.state?.scale() ?? BASE_SCALE);
    const target = growPullForScale(scale);
    if (dt <= 0) {
      this.camGrowPull = target;
      return target;
    }
    this.camGrowPull += (target - this.camGrowPull) * Math.min(1, dt * 4.2);
    return this.camGrowPull;
  }

  private frameDist(dt = 0): number {
    const state = this.state;
    const pull = this.cameraGrowPull(dt);
    if (this.globe) return (9 + 6 / pull) * Math.pow(pull, 0.35);
    const world = state?.world ?? 0;
    const { cols, rows } = state ? gridOf(world) : { cols: 8, rows: 6 };
    const span = Math.max(cols * TILE, rows * TILE);
    const worldPad = 1 + world * 0.055;
    return clamp(span * 0.35 * worldPad * pull, 8, 34);
  }

  private dressSky(t: number): void {
    const state = this.state;
    const backX = -Math.sin(YAW);
    const backZ = -Math.cos(YAW);
    const rightX = Math.cos(YAW);
    const rightZ = -Math.sin(YAW);
    let anchorX = this.camX;
    let anchorZ = this.camZ;
    let span = 22;
    if (this.terrain && state && !this.globe) {
      anchorX = this.terrain.originX + this.terrain.width * 0.5;
      anchorZ = this.terrain.originZ + this.terrain.depth * 0.5;
      span = Math.max(this.terrain.width, this.terrain.depth);
      this.hillsBackdrop.position.set(
        anchorX + backX * span * 0.62,
        0.35 + Math.sin(t * 0.25) * 0.04,
        anchorZ + backZ * span * 0.62,
      );
      this.hillsBackdrop.scale.set(span * 1.05, span * 0.32, 1);
    }
    this.puffs.forEach((mesh, i) => {
      const drift = this.puffDrift[i] ?? 0;
      const spread = (i - 3.5) * 4.6 + Math.sin(t * 0.15 + drift) * 1.2;
      const depth = 14 + (i % 4) * 3.5;
      const y = 8.5 + (i % 3) * 1.8 + Math.sin(t * 0.45 + drift) * 0.35;
      const slide = Math.sin(t * 0.08 + drift) * 2.4;
      mesh.position.set(
        anchorX + backX * depth + rightX * (spread + slide),
        y,
        anchorZ + backZ * depth + rightZ * (spread * 0.35),
      );
    });
    this.shafts.forEach((shaft, i) => {
      const sm = shaft.material as THREE.MeshBasicMaterial;
      const base = Number(shaft.userData['shaftBase']) || 0.08;
      const amp = Number(shaft.userData['shaftAmp']) || 0.05;
      sm.opacity = base + Math.sin(t * 0.55 + i * 1.4) * amp;
      shaft.position.set(anchorX - 5 + i * 2.8, 5.5, anchorZ + backZ * span * 0.35 + i * 0.6);
      shaft.rotation.z = 0.42 + i * 0.08;
    });
    for (const bird of this.birds) {
      const ang = t * bird.speed + bird.phase;
      const flap = Math.sin(t * 9 + bird.phase) > 0 ? 1 : 0.82;
      bird.mesh.position.set(
        anchorX + Math.cos(ang) * bird.radius,
        bird.height + Math.sin(t * 1.2 + bird.phase) * 0.35,
        anchorZ + Math.sin(ang) * bird.radius * 0.65,
      );
      bird.mesh.scale.set(flap, 1, 1);
      const visible = (state?.ratio() ?? 0) > 0.04 || (state?.world ?? 0) > 0;
      bird.mesh.visible = visible;
    }
  }

  private faceAll(): void {
    this.scene.traverse((obj) => {
      if (!obj.userData['bb']) return;
      const roll = obj === this.cloud ? Number(obj.userData['roll']) || 0 : 0;
      obj.lookAt(this.camera.position);
      obj.rotateY(Math.PI);
      if (roll) obj.rotateZ(roll);
    });
  }

  private nearestTile(): number {
    const state = this.state;
    if (!state) return 0;
    if (this.globe) {
      const a = this.anchor();
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < state.current().length; i += 1) {
        const p = this.tilePos(i);
        const d = (p.x - a.x) ** 2 + (p.y - a.y) ** 2 + (p.z - a.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    }
    const { cols, rows } = gridOf(state.world);
    const c = clamp(Math.round(this.cloudX / TILE), 0, cols - 1);
    const r = clamp(Math.round(this.cloudZ / TILE), 0, rows - 1);
    return r * cols + c;
  }

  private tilePos(index: number): { x: number; y: number; z: number } {
    const state = this.state;
    const cols = state ? gridOf(state.world).cols : 1;
    const rows = state ? gridOf(state.world).rows : 1;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const h = (state?.spec(index).height ?? 2) * 0.46;
    if (state?.world === GLOBE_WORLD) {
      const lon = (col / cols) * Math.PI * 2;
      const lat = (row / Math.max(1, rows - 1) - 0.5) * Math.PI * 0.82;
      return this.lonLatPoint(lon, lat, 6.7 + h * 0.12);
    }
    const x = col * TILE;
    const z = row * TILE;
    return { x, y: this.terrain ? this.terrain.heightAt(x, z) : h, z };
  }

  private lonLatPoint(lon: number, lat: number, radius: number): { x: number; y: number; z: number } {
    return {
      x: Math.cos(lat) * Math.sin(lon) * radius,
      y: Math.sin(lat) * radius,
      z: Math.cos(lat) * Math.cos(lon) * radius,
    };
  }

  private anchor(): { x: number; y: number; z: number } {
    if (this.globe) return this.lonLatPoint(this.cloudX, this.cloudZ, 6.85);
    return { x: this.cloudX, y: this.groundY(this.cloudX, this.cloudZ), z: this.cloudZ };
  }

  private groundY(x: number, z: number): number {
    const state = this.state;
    if (!state || this.globe) return 1;
    if (this.terrain) return this.terrain.heightAtSmooth(x, z);
    const { cols, rows } = gridOf(state.world);
    const c = clamp(Math.round(x / TILE), 0, cols - 1);
    const r = clamp(Math.round(z / TILE), 0, rows - 1);
    return state.spec(r * cols + c).height * 0.46;
  }

  private spawnAt(): { x: number; z: number } {
    const state = this.state;
    if (!state) return { x: 0, z: 0 };
    if (state.world === GLOBE_WORLD) return { x: 0.2, z: 0.15 };
    const { cols, rows } = gridOf(state.world);
    return { x: ((cols - 1) * TILE) / 2, z: ((rows - 1) * TILE) * 0.52 };
  }

  private dropCloud(at: { x: number; z: number }): void {
    this.cloudX = at.x;
    this.cloudZ = at.z;
    this.prevX = at.x;
    this.prevZ = at.z;
    this.camX = at.x;
    this.camZ = at.z;
    const gy = this.groundY(at.x, at.z);
    this.camGroundY = gy;
    this.hoverY = gy + 1.35 + 2.1 * (this.state?.scale() ?? 0.48);
    this.cloud.position.set(at.x, this.hoverY, at.z);
    this.placeCamera(0);
  }

  private restoredSpots(): number[] {
    const state = this.state;
    if (!state) return [0];
    const spots: number[] = [];
    const tiles = state.current();
    for (let i = 0; i < tiles.length; i += 1) if (state.isRestored(i)) spots.push(i);
    return spots.length > 0 ? spots : [0];
  }

  private spawnBaby(): void {
    const mesh = this.billboard(this.art.baby, 0.8, 0.52, 0.15);
    const x = this.cloudX + (Math.random() > 0.5 ? -6 : 6);
    const z = this.cloudZ + (Math.random() - 0.5) * 6;
    mesh.position.set(x, 2.5, z);
    this.scene.add(mesh);
    this.babies.push({ mesh, x, z });
  }

  private spawnTornado(): void {
    if (this.tornado) this.scene.remove(this.tornado.mesh);
    const len = Math.hypot(this.faceX, this.faceZ) || 1;
    this.faceX /= len;
    this.faceZ /= len;
    const mesh = this.billboard(this.art.tornado, 1.15, 1.35, 0.15);
    mesh.position.set(this.cloudX, 1.05, this.cloudZ);
    this.scene.add(mesh);
    this.tornado = { mesh, x: this.cloudX, z: this.cloudZ, life: 3.4, acc: 0 };
  }

  private flashBolt(center: number): void {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 6),
      new THREE.MeshBasicMaterial({ color: '#b8f3ff', transparent: true, opacity: 1, depthWrite: false }),
    );
    const at = this.views[center] ?? this.tilePos(center);
    const x = 'x' in at ? at.x : 0;
    const z = 'z' in at ? at.z : 0;
    mesh.position.set(x, 3.1, z);
    mesh.userData['bb'] = 1;
    this.scene.add(mesh);
    this.bolts.push({ mesh, life: 0.22 });
  }

  private rippleAt(x: number, z: number, color: string): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.34, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.14, z);
    this.scene.add(mesh);
    this.rings.push({ mesh, life: 1 });
  }

  private leapKoi(index: number): void {
    const view = this.views[index];
    for (let n = 0; n < 3; n += 1) {
      const mote = this.takeMote(this.art.koi);
      if (!mote) continue;
      mote.mesh.position.set((view?.x ?? 0) + (n - 1) * 0.22, 0.4, view?.z ?? 0);
      mote.life = 0.9;
      mote.vy = 1.6 + n * 0.2;
      mote.vx = (n - 1) * 0.35;
      mote.vz = 0.2;
    }
  }

  private launchDrop(): void {
    const drop = this.drops.find((d) => !d.alive);
    if (!drop) return;
    const reach = Math.max(0.45, this.state?.reach() ?? 1);
    drop.alive = true;
    drop.mesh.visible = true;
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * reach * 0.9;
    drop.mesh.position.x = this.cloud.position.x + Math.cos(a) * d;
    drop.mesh.position.z = this.cloud.position.z + Math.sin(a) * d;
    drop.y = this.cloud.position.y - 0.25;
    drop.mesh.position.y = drop.y;
    drop.vy = 5.5 + Math.random() * 2;
    const grown = 0.95 + (this.state?.ranks.specks ?? 0) * 0.1;
    drop.mesh.scale.setScalar(grown + Math.random() * 0.25);
  }

  private burst(x: number, y: number, z: number, count: number): void {
    const maps = [this.art.star, this.art.leaf, this.art.spark];
    for (let i = 0; i < count; i += 1) {
      const mote = this.takeMote(maps[i % maps.length] ?? this.art.spark);
      if (!mote) break;
      mote.mesh.position.set(x, y, z);
      mote.life = 0.7 + Math.random() * 0.35;
      mote.vx = (Math.random() - 0.5) * 2.2;
      mote.vz = (Math.random() - 0.5) * 2.2;
      mote.vy = 1.1 + Math.random() * 1.5;
    }
  }

  private floatText(x: number, y: number, text: string, crit: boolean): void {
    const floater = this.texts.find((f) => f.life <= 0);
    if (!floater) return;
    const mat = floater.mesh.material as THREE.MeshBasicMaterial;
    const map = mat.map as THREE.CanvasTexture;
    const canvas = map.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '700 52px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 10;
    ctx.strokeStyle = crit ? '#7a2060' : '#7a3e00';
    ctx.strokeText(text, canvas.width / 2, 62);
    const grd = ctx.createLinearGradient(0, 16, 0, 70);
    grd.addColorStop(0, '#fff6c2');
    grd.addColorStop(1, crit ? '#ff8fb8' : '#ffb703');
    ctx.fillStyle = grd;
    ctx.fillText(text, canvas.width / 2, 62);
    map.needsUpdate = true;
    floater.mesh.position.set(x, y, 0);
    floater.mesh.scale.setScalar(1);
    floater.life = 1.05;
    floater.vy = 0.7;
    floater.mesh.visible = true;
    mat.opacity = 1;
  }

  private seedPools(): void {
    for (let i = 0; i < 18; i += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 96;
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.48),
        new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }),
      );
      mesh.userData['bb'] = 1;
      mesh.visible = false;
      this.scene.add(mesh);
      this.texts.push({ mesh, life: 0, vy: 0 });
    }
    const bits = [this.art.star, this.art.leaf, this.art.spark, this.art.heart, this.art.koi];
    for (let i = 0; i < 80; i += 1) {
      const mesh = this.billboard(bits[i % bits.length] ?? this.art.spark, 0.32, 0.32, 0.04);
      mesh.visible = false;
      (mesh.material as THREE.MeshBasicMaterial).depthWrite = false;
      this.scene.add(mesh);
      this.motes.push({ mesh, life: 0, vx: 0, vy: 0, vz: 0 });
    }
    for (let i = 0; i < 48; i += 1) {
      const mesh = this.billboard(this.art.drop, 0.22, 0.34, 0.12);
      mesh.visible = false;
      this.scene.add(mesh);
      this.drops.push({ mesh, y: 0, vy: 0, alive: false });
    }
  }

  private takeMote(map: THREE.Texture): Mote | null {
    const mote = this.motes.find((m) => m.life <= 0);
    if (!mote) return null;
    (mote.mesh.material as THREE.MeshBasicMaterial).map = map;
    (mote.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
    mote.mesh.visible = true;
    return mote;
  }

  private propMesh(decor: 'tree' | 'bush' | 'rock' | 'twig', restored: boolean, world: number): THREE.Mesh | null {
    if (decor === 'tree') return this.billboard(this.propTexture(decor, restored, world, false), 2.15, 2.9, 0.18);
    if (decor === 'bush') return this.billboard(this.propTexture(decor, restored, world, false), 0.72, 0.55, 0.2);
    if (decor === 'rock') return this.billboard(world === 3 && !restored ? this.art.barrel : this.propTexture(decor, restored, world, false), 0.62, 0.42, 0.2);
    return this.billboard(this.propTexture(decor, restored, world, false), 0.55, 0.4, 0.18);
  }

  private propTexture(decor: 'tree' | 'bush' | 'rock' | 'twig', restored: boolean, world: number, seed: boolean): THREE.Texture {
    const art = this.art;
    if (seed) return restored ? art.money : art.seed;
    if (decor === 'tree') return (restored ? art.liveTree[world] : art.deadTree[world]) ?? art.deadTree[0]!;
    if (decor === 'bush') return restored ? art.bushLive : art.bushDead;
    if (decor === 'rock') {
      if (world === 3 && !restored) return art.barrel;
      return restored ? art.rockMoss : art.rock;
    }
    return restored ? art.flowers : art.twig;
  }

  private glowTexture(kind: 'shaft' | 'soft'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      if (kind === 'shaft') {
        g.addColorStop(0, 'rgba(255, 248, 220, 0)');
        g.addColorStop(0.35, 'rgba(255, 240, 200, 0.55)');
        g.addColorStop(0.7, 'rgba(255, 230, 180, 0.2)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  private billboard(map: THREE.Texture, w: number, h: number, alphaTest: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest, side: THREE.DoubleSide }),
    );
    mesh.userData['ph'] = h;
    mesh.userData['s'] = 1;
    mesh.userData['bb'] = 1;
    return mesh;
  }

  private pushHud(force: boolean): void {
    const state = this.state;
    if (!state) return;
    let pond: number | null = null;
    const center = this.nearestTile();
    if (state.spec(center).kind === 'pond' && !state.isRestored(center)) {
      pond = state.current()[center]?.pond ?? 0;
    }
    const sleepy = state.tank <= 0.01;
    if (force || this.hudAcc >= 0) {
      this.onHud(
        state.snapshot({
          raining: this.wantsRain() && !sleepy,
          sleepy,
          slosh: this.slosh,
          music: this.audio.musicOn,
          pond,
        }),
      );
    }
  }

  private async saveNow(): Promise<void> {
    if (!this.state || this.dead || this.skipSave) return;
    await writeProgress(this.state.toJSON());
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const texel = this.tilt.uniforms['uTexel']?.value as THREE.Vector2 | undefined;
    if (texel) texel.set(1 / (w * this.renderer.getPixelRatio()), 1 / (h * this.renderer.getPixelRatio()));
  }

  private clearGroup(group: THREE.Group): void {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
    }
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
