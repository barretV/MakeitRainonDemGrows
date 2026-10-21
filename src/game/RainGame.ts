import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLOBE_WORLD, TILE, gridOf, tileIsLand, worldDef, type Decor } from './balance';
import { Terrain } from './terrain';
import { getArt, type ArtSet, type CloudMood } from './pixels';
import { litColor, litOpacity, makeLitSprite, makePondWater, setLitMap } from './litSprite';
import { ABILITIES, type AbilityId } from './abilities';
import { AbilityVfx } from './abilityVfx';
import { BASE_SCALE, maskOf, upgradeNode, type NodeId, type Ranks } from './tree';
import { AudioBus } from './audio';
import { clearProgress, readProgress, writeProgress } from './save';
import { SaveState, formatDew, walletDew, type DryTarget, type HudModel, type RunPhase, type SoakResult } from './state';
import { loadStowKitPack } from '../loadStowKitPack';

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
/** Radians of camera turn per pixel of the second touch stick. */
const TURN_TOUCH = 0.007;
/** 1 = default framing (closest). Larger values pull the camera back. */
const CAM_ZOOM_MIN = 1;
const CAM_ZOOM_MAX = 1.85;
/**
 * Katamari framing: the rig keeps a close patch of land in frame and follows the
 * cloud over it. Islands stay big in the world, so they run past the frame
 * instead of shrinking the cloud into a speck.
 */
const CAM_FRAME_SPAN = 19.2;
/** Where the rig aims relative to the ground it is over: just under the surface. */
const CAM_LOOK = -0.92;
/** How high the cloud hovers over the ground, and how much of that is size. */
const CLOUD_CLEARANCE = 1.35;
const CLOUD_LIFT = 2.1;
const FINALE_DURATION = 7.2;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
/** Metres from root to crown top in the exported hero-tree GLB. */
/** The pack strips the armature scale, so fit the measured canopy slightly inside the billboard height. */

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

/** The rain ring is a plane: its face is +Z, and it lies flat when tipped -90° about X. */
const RING_FACE = new THREE.Vector3(0, 0, 1);
const RING_AXIS = new THREE.Vector3(1, 0, 0);
/** How many thirsty pockets can glow at once. */
const AURA_COUNT = 6;
/** The face of the aura ring, so it can lie flat on the ground or on the globe. */
const AURA_NORMAL = new THREE.Vector3(0, 0, 1);

/** A jagged lightning ribbon, built in the XY plane so the billboard faces the camera. */
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
    const w = i === 0 || i === points.length - 1 ? width * 0.5 : width;
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

/** Bright core with a soft halo around the bolt. */
function boltMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
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
        float edge = abs(vUv.x - 0.5) * 2.0;
        float core = 1.0 - smoothstep(0.0, 0.45, edge);
        float glow = 1.0 - smoothstep(0.2, 1.0, edge);
        vec3 col = mix(vec3(0.55, 0.85, 1.0), vec3(1.0), core);
        gl_FragColor = vec4(col, (core * 0.95 + glow * 0.45) * (0.55 + 0.45 * (1.0 - vUv.y)));
      }
    `,
  });
}

/**
 * Camera pull-back vs puff size. Kept gentle on purpose: the cloud has to keep
 * reading as bigger after an upgrade, so the rig barely steps back for it.
 */
function growPullForScale(scale: number): number {
  return Math.pow(Math.max(BASE_SCALE, scale) / BASE_SCALE, 0.35);
}

const TiltShiftShader = {
  name: 'TiltShift',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /** Screen height (0 = bottom) where the far-distance blur starts. */
    uFocus: { value: 0.9 },
    /** The cloud on screen, so the blur never smears the player's own avatar. */
    uCloud: { value: new THREE.Vector2(0.5, 0.5) },
    uCloudSize: { value: new THREE.Vector2(0.08, 0.05) },
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
    uniform float uFocus;
    uniform vec2 uCloud;
    uniform vec2 uCloudSize;
    varying vec2 vUv;
    void main() {
      // The blur band hugs the top of the frame, but it opens up around the cloud
      // so the rain you are pouring always stays crisp.
      vec2 cd = (vUv - uCloud) / max(uCloudSize, vec2(0.001));
      float near = 1.0 - smoothstep(0.75, 1.6, length(cd));
      float amt = smoothstep(uFocus, uFocus + 0.15, vUv.y) * (1.0 - near);
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
      col.rgb *= mix(0.74, 1.0, vig);
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
  growT: number;
  growStart: number;
  /** Last prop ladder step (0 dead litter, 1 sprout, 2 grown) for pop-ins. */
  stage: number;
  /** Prop (after billboard displacement) hangs off the island edge. */
  offIsland: boolean;
  /** Pond water sprite that scales up as the basin fills. */
  pondWater: THREE.Mesh | null;
  pondLily: THREE.Mesh[];
  pondFrog: THREE.Mesh | null;
  pondFill: number;
  pondStage: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

interface AmbMote {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  phase: number;
  spin: number;
}

interface WindTrail {
  mesh: THREE.Mesh;
  phase: number;
  speed: number;
  y: number;
  dir: number;
}

interface SoftCloud {
  mesh: THREE.Mesh;
  phase: number;
  depth: number;
  speed: number;
  lift: number;
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
  vx: number;
  vz: number;
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

interface ParallaxIsland {
  mesh: THREE.Mesh;
  spread: number;
  depth: number;
  altitude: number;
  parallax: number;
  bobPhase: number;
  size: number;
}

interface Stick {
  id: number;
  x: number;
  y: number;
  cx: number;
  cz: number;
}

/** The second touch stick only turns the camera. */
interface TurnStick {
  id: number;
  x: number;
}

export class RainGame {
  readonly audio = new AudioBus();
  private readonly onHud: (model: HudModel) => void;
  private readonly container: HTMLDivElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly tilt: ShaderPass;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly cloudProbe = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private readonly art: ArtSet;
  private readonly timeU = { value: 0 };
  private readonly sunDir = new THREE.Vector3(0.62, 0.22, -0.28).normalize();
  private readonly sunColor = new THREE.Color(1, 0.86, 0.62);
  private readonly sunClear = new THREE.Color(1, 0.52, 0.38);
  private readonly propDusk = new THREE.Color('#4a2038');
  private readonly propSun = new THREE.Color('#fff1e4');
  private readonly sunOvercast = new THREE.Color(0.55, 0.68, 0.82);
  private readonly cloudShadow = new THREE.Vector3(0, 0, 2.4);
  private readonly rainUniform = { value: 0 };
  private state: SaveState | null = null;
  private dead = false;
  private skipSave = false;
  private frame = 0;
  private hudAcc = 0;
  private lastPhase: RunPhase = 'play';
  private finaleT = 0;
  private finaleHudAcc = 0;
  private saveAcc = 0;
  private soakAcc = 0;
  private dropAcc = 0;
  private babyAcc = 2;
  private stick: Stick | null = null;
  private rotateStick: TurnStick | null = null;
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
  /** Full orbit around the island. 0 puts the camera on +Z (screen-up is −Z). */
  private camYaw = 0;
  private finaleCamYaw0 = 0;
  private finaleCamZoom0 = 1;
  private finaleFocalX = 0;
  private finaleFocalZ = 0;
  private skyDome: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;
  private skyMotes!: THREE.Points;
  private sunDisc: THREE.Mesh;
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
  /** The colour the distance fades into. Deeper than the sky, so the haze reads as depth. */
  private readonly fogBase = new THREE.Color();
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private maskTex: THREE.DataTexture | null = null;
  private pulseTex: THREE.DataTexture | null = null;
  private terrain: Terrain | null = null;
  private maskMats: THREE.ShaderMaterial[] = [];
  private abilityVfx: AbilityVfx;
  private globe = false;
  private track = new THREE.Group();
  private views: TileView[] = [];
  private cloud: THREE.Mesh;
  private curtain: THREE.Mesh;
  private rainRing: THREE.Mesh;
  private auras: { ring: THREE.Mesh; wisp: THREE.Mesh }[] = [];
  private propShadows: THREE.InstancedMesh | null = null;
  private waterfalls: { fall: THREE.Mesh; mist: THREE.Mesh; stream: THREE.Mesh }[] = [];
  private readonly shadowMatrix = new THREE.Matrix4();
  private readonly shadowPos = new THREE.Vector3();
  private readonly shadowQuat = new THREE.Quaternion();
  private readonly shadowScale = new THREE.Vector3();
  private aimArrow: THREE.Mesh;
  private auraTick = 0;
  private auraTargets: DryTarget[] = [];
  private auraCells = 0;
  private auraActive = false;
  private puddle: THREE.Mesh;
  private mountain: THREE.Mesh;
  private spaceDome!: THREE.Mesh;
  private atmo!: THREE.Mesh;
  private peaks: THREE.Mesh[] = [];
  private hillsBackdrop: THREE.Mesh;
  private hillsFar: THREE.Mesh;
  private sunHalo: THREE.Mesh;
  private shafts: THREE.Mesh[] = [];
  private sunSpots: { x: number; z: number; w: number }[] = [];
  private sunSpotTick = -1;
  private puffs: THREE.Mesh[] = [];
  private puffDrift: number[] = [];
  private softClouds: SoftCloud[] = [];
  private winds: WindTrail[] = [];
  private ambient: AmbMote[] = [];
  private rainbow: THREE.Mesh;
  private mist: THREE.Mesh;
  private rainMix = 0;
  private birds: SkyBird[] = [];
  private farTrees: THREE.Mesh[] = [];
  private parallaxIslands: ParallaxIsland[] = [];
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
    // ACES desaturates and flattens the midtones, which turns a sunset into
    // milk. The Khronos neutral curve keeps the colour in the pixels and only
    // rolls off what is really too bright.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.domElement.className = 'stage-canvas';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.35, 420);
    this.scene.background = new THREE.Color('#4a2038');
    this.scene.fog = new THREE.Fog('#4a2038', 24, 52);
    this.scene.add(this.track);
    this.scene.add(this.camera);
    this.abilityVfx = new AbilityVfx(this.track);

    this.mountain = this.litBillboard(this.art.mountain, 15, 9.2, 0.12, true);
    this.scene.add(this.mountain);
    for (let i = 0; i < 2; i += 1) {
      const peak = this.litBillboard(this.art.mountain, 11, 7.5, 0.12, true);
      peak.scale.setScalar(0.72 + i * 0.12);
      this.peaks.push(peak);
      this.scene.add(peak);
    }

    const puff = document.createElement('canvas');
    puff.width = 128;
    puff.height = 64;
    const puffCtx = puff.getContext('2d');
    if (puffCtx) {
      const softEdge = puffCtx.createRadialGradient(64, 38, 6, 64, 38, 58);
      softEdge.addColorStop(0, 'rgba(255,255,255,0.24)');
      softEdge.addColorStop(1, 'rgba(255,255,255,0)');
      puffCtx.fillStyle = softEdge;
      puffCtx.beginPath();
      puffCtx.ellipse(64, 38, 62, 26, 0, 0, Math.PI * 2);
      puffCtx.fill();
      const body = puffCtx.createLinearGradient(0, 10, 0, 56);
      body.addColorStop(0, 'rgba(255,255,255,0.98)');
      body.addColorStop(0.55, 'rgba(255,252,255,0.95)');
      body.addColorStop(1, 'rgba(243,230,248,0.82)');
      puffCtx.fillStyle = body;
      puffCtx.beginPath();
      puffCtx.ellipse(64, 36, 48, 18, 0, 0, Math.PI * 2);
      puffCtx.ellipse(40, 40, 28, 16, 0, 0, Math.PI * 2);
      puffCtx.ellipse(92, 38, 26, 14, 0, 0, Math.PI * 2);
      puffCtx.ellipse(52, 26, 18, 12, 0, 0, Math.PI * 2);
      puffCtx.ellipse(80, 27, 16, 11, 0, 0, Math.PI * 2);
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
      puffMat.color.set('#5a3048');
      puffMat.opacity = 0.34 + (i % 3) * 0.04;
      puffMat.transparent = true;
      this.puffs.push(mesh);
      this.puffDrift.push(i * 1.7);
      this.scene.add(mesh);
    }

    const shaftTex = this.glowTexture('shaft');
    for (let i = 0; i < 6; i += 1) {
      const shaft = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 12),
        new THREE.MeshBasicMaterial({
          map: shaftTex,
          color: 0xffe7a8,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
      );
      shaft.renderOrder = 4;
      shaft.userData['bb'] = 1;
      shaft.userData['gw'] = 1.4;
      shaft.userData['ph'] = 12;
      shaft.userData['shaftPhase'] = i * 1.7;
      this.shafts.push(shaft);
      this.scene.add(shaft);
    }
    for (let i = 0; i < 4; i += 1) {
      const pin = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 18),
        new THREE.MeshBasicMaterial({
          map: shaftTex,
          color: 0xffd15a,
          transparent: true,
          opacity: 0,
          blending: THREE.NormalBlending,
          depthWrite: false,
          fog: false,
          toneMapped: false,
          side: THREE.DoubleSide,
        }),
      );
      pin.renderOrder = 5;
      pin.userData['bb'] = 1;
      pin.userData['gw'] = 0.7;
      pin.userData['ph'] = 18;
      pin.userData['shaftPhase'] = i * 1.4;
      this.scene.add(pin);
    }

    this.sunHalo = this.billboard(this.art.sunGlow, 1, 1, 0.02);
    {
      const haloMat = this.sunHalo.material as THREE.MeshBasicMaterial;
      haloMat.fog = false;
      haloMat.depthWrite = false;
      haloMat.toneMapped = false;
      haloMat.blending = THREE.AdditiveBlending;
      this.sunHalo.renderOrder = -9;
      this.scene.add(this.sunHalo);
    }

    this.hillsFar = this.litBillboard(this.art.hills[0]!, 44, 3.3, 0.06, true);
    {
      const farMat = this.hillsFar.material as THREE.ShaderMaterial;
      farMat.toneMapped = false;
      litOpacity(farMat).value = 0.6;
      this.hillsFar.userData['bb'] = 1;
      this.scene.add(this.hillsFar);
    }

    this.rainbow = this.billboard(this.art.rainbow, 30, 15, 0.02);
    {
      const bowMat = this.rainbow.material as THREE.MeshBasicMaterial;
      bowMat.fog = false;
      bowMat.transparent = true;
      bowMat.opacity = 0;
      bowMat.depthWrite = false;
      bowMat.toneMapped = false;
      this.rainbow.renderOrder = -7;
      this.scene.add(this.rainbow);
    }

    this.mist = this.billboard(this.glowTexture('mist'), 30, 4, 0.02);
    {
      const mistMat = this.mist.material as THREE.MeshBasicMaterial;
      mistMat.fog = false;
      mistMat.transparent = true;
      mistMat.opacity = 0;
      mistMat.depthWrite = false;
      mistMat.toneMapped = false;
      this.mist.renderOrder = 4;
      this.scene.add(this.mist);
    }

    for (let i = 0; i < 5; i += 1) {
      // Lit sprites, so the cloud banks catch the sun instead of reading as
      // cut-out cardboard.
      const mesh = this.litBillboard(this.art.softCloud, 3, 1.4, 0.02, true);
      const cloudMat = mesh.material as THREE.ShaderMaterial;
      cloudMat.transparent = true;
      cloudMat.depthWrite = false;
      cloudMat.toneMapped = false;
      litColor(cloudMat).set('#6a3850');
      litOpacity(cloudMat).value = 0.42 - (i % 3) * 0.06;
      mesh.renderOrder = -4;
      this.scene.add(mesh);
      this.softClouds.push({
        mesh,
        phase: i * 1.7,
        depth: 1 + (i % 3) * 0.24,
        speed: 0.5 + (i % 3) * 0.28,
        lift: 0.1 + (i % 4) * 0.05,
      });
    }

    for (let i = 0; i < 7; i += 1) {
      const mesh = this.billboard(this.art.windStreak, 2.6, 0.5, 0.02);
      const windMat = mesh.material as THREE.MeshBasicMaterial;
      windMat.fog = false;
      windMat.transparent = true;
      windMat.depthWrite = false;
      windMat.toneMapped = false;
      windMat.opacity = 0;
      mesh.visible = false;
      this.scene.add(mesh);
      this.winds.push({ mesh, phase: i * 0.9, speed: 3.4 + (i % 3) * 1.6, y: 0.9 + (i % 4) * 0.42, dir: i % 2 === 0 ? 1 : -1 });
    }

    const ambientMaps = [this.art.petal, this.art.pollen, this.art.leaf, this.art.petal, this.art.pollen];
    for (let i = 0; i < 26; i += 1) {
      const map = ambientMaps[i % ambientMaps.length]!;
      const mesh = this.billboard(map, 0.16, 0.16, 0.02);
      const ambMat = mesh.material as THREE.MeshBasicMaterial;
      ambMat.fog = false;
      ambMat.transparent = true;
      ambMat.depthWrite = false;
      ambMat.opacity = 0.55 + (i % 3) * 0.15;
      mesh.visible = false;
      mesh.renderOrder = 6;
      this.scene.add(mesh);
      const kind = i % ambientMaps.length;
      this.ambient.push({
        mesh,
        vx: 0.5 + (i % 4) * 0.25,
        vy: kind === 1 ? 0.16 + (i % 3) * 0.05 : -0.32 - (i % 3) * 0.12,
        vz: ((i % 5) - 2) * 0.14,
        phase: i * 1.07,
        spin: kind === 2 ? 2.4 : 1.1,
      });
    }

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uRain: { value: 0 },
        uLife: { value: 0 },
        uTop: { value: new THREE.Color('#6a3d78') },
        uMid: { value: new THREE.Color('#c46a8a') },
        uBot: { value: new THREE.Color('#f0a0c4') },
        uSunDir: { value: this.sunDir },
        uCamUp: { value: new THREE.Vector3(0, 1, 0) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uRain;
        uniform float uLife;
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uBot;
        uniform vec3 uSunDir;
        uniform vec3 uCamUp;
        varying vec3 vWorld;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.07 + vec2(1.7, 9.2);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorld - cameraPosition);
          float elev = dot(dir, normalize(uCamUp));
          vec3 sky = mix(uBot, uMid, smoothstep(-0.55, 0.0, elev));
          sky = mix(sky, uTop, smoothstep(-0.08, 0.42, elev));
          sky = mix(sky, uTop * vec3(0.55, 0.45, 0.75), smoothstep(0.22, 0.7, elev));
          vec3 warm = mix(uBot, vec3(0.95, 0.45, 0.42), 0.45);
          sky = mix(sky, warm, smoothstep(0.02, -0.28, elev) * 0.42);

          vec3 sunDir = normalize(uSunDir);
          float d = max(dot(dir, sunDir), 0.0);
          float glow = pow(d, 3.2);
          float core = pow(d, 22.0);
          float disc = smoothstep(0.992, 0.998, d);
          vec3 axis = abs(sunDir.y) > 0.92 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
          vec3 side = normalize(cross(sunDir, axis));
          float fan = abs(dot(dir, side));
          float rays = pow(abs(sin(fan * 18.0 + uTime * 0.22)), 14.0) * pow(d, 4.0);
          float clear = 1.0 - uRain * 0.55;
          sky += vec3(1.0, 0.46, 0.38) * glow * 0.22 * clear;
          sky += vec3(1.0, 0.62, 0.42) * core * 0.28 * clear;
          sky += vec3(1.0, 0.7, 0.5) * disc * 0.42;
          sky += vec3(1.0, 0.5, 0.4) * rays * 0.12 * clear;

          vec2 cuv = vec2(atan(dir.z, dir.x) * 1.4, elev * 2.2) + vec2(uTime * 0.03, uTime * 0.01);
          float cl = fbm(cuv);
          float high = smoothstep(0.12, 0.34, elev) * smoothstep(0.98, 0.42, elev);
          vec3 cloudCol = mix(uMid, uBot, 0.4);
          sky = mix(sky, cloudCol, smoothstep(0.52, 0.8, cl) * high * 0.22 * (1.0 - uRain * 0.4));

          float ang = atan(dir.z, dir.x);
          float ridge = -0.02 + 0.055 * fbm(vec2(ang * 1.6, 2.2));
          float hill = smoothstep(ridge + 0.03, ridge - 0.012, elev) * smoothstep(-0.18, 0.04, elev);
          vec3 hillCol = mix(uTop, vec3(0.22, 0.1, 0.18), 0.72);
          sky = mix(sky, hillCol, hill * 0.8);

          float night = smoothstep(0.42, 0.14, dot(uTop, vec3(0.25, 0.5, 0.25)));
          vec2 cell = floor(dir.xy * 70.0 + dir.z * 40.0);
          float hsh = hash(cell);
          float star = step(0.986, hsh);
          float tw = 0.55 + 0.45 * sin(uTime * 1.6 + hsh * 30.0);
          sky += vec3(1.0, 0.96, 0.9) * star * tw * night * smoothstep(0.2, 0.55, elev) * 0.18;

          float motes = fbm(dir.xy * 6.0 + vec2(uTime * 0.04, 0.0));
          sky += vec3(0.55, 0.95, 0.62) * motes * uLife * 0.07 * smoothstep(-0.05, 0.35, elev);

          sky = mix(sky, sky * vec3(0.55, 0.42, 0.5), uRain * 0.35);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 32), this.skyMat);

    const moteCount = 180;
    const motePos = new Float32Array(moteCount * 3);
    const motePhase = new Float32Array(moteCount);
    for (let i = 0; i < moteCount; i += 1) {
      const ang = (i / moteCount) * Math.PI * 2 + (i % 5) * 0.31;
      const radius = 28 + (i % 8) * 4.2;
      motePos[i * 3] = Math.cos(ang) * radius;
      motePos[i * 3 + 1] = 14 + (i % 12) * 1.5;
      motePos[i * 3 + 2] = Math.sin(ang) * radius;
      motePhase[i] = i * 0.41;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    moteGeo.setAttribute('aPhase', new THREE.BufferAttribute(motePhase, 1));
    this.skyMotes = new THREE.Points(
      moteGeo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aPhase;
          uniform float uTime;
          varying float vTw;
          void main() {
            vec3 p = position;
            p.y += sin(uTime * 0.45 + aPhase) * 0.8;
            p.x += cos(uTime * 0.18 + aPhase) * 0.6;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (2.4 + sin(aPhase) * 1.1) * (70.0 / max(18.0, -mv.z));
            gl_Position = projectionMatrix * mv;
            vTw = 0.45 + 0.55 * sin(uTime * 1.7 + aPhase * 2.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vTw;
          void main() {
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            float a = smoothstep(0.5, 0.08, d) * vTw;
            if (a < 0.05) discard;
            vec3 col = mix(vec3(1.0, 0.82, 0.45), vec3(0.75, 1.0, 0.9), step(0.0, uv.y));
            gl_FragColor = vec4(col, a);
          }
        `,
      }),
    );
    this.skyMotes.frustumCulled = false;
    this.skyMotes.renderOrder = -4;
    this.scene.add(this.skyMotes);
    this.skyDome.renderOrder = -20;
    this.skyDome.frustumCulled = false;
    this.scene.add(this.skyDome);

    this.spaceDome = new THREE.Mesh(
      new THREE.SphereGeometry(150, 40, 24),
      new THREE.MeshBasicMaterial({
        map: this.art.space,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.spaceDome.renderOrder = -21;
    this.spaceDome.frustumCulled = false;
    this.spaceDome.visible = false;
    this.scene.add(this.spaceDome);

    // atmosphere halo behind the restored-world planet
    this.atmo = this.billboard(this.glowTexture('halo'), 20, 20, 0.01);
    {
      const atmoMat = this.atmo.material as THREE.MeshBasicMaterial;
      atmoMat.fog = false;
      atmoMat.transparent = true;
      atmoMat.depthWrite = false;
      atmoMat.blending = THREE.AdditiveBlending;
      atmoMat.color.set('#79d6ff');
      atmoMat.opacity = 0.5;
      this.atmo.renderOrder = -6;
      this.atmo.visible = false;
      this.scene.add(this.atmo);
    }

    this.sunDisc = this.billboard(this.art.sun, 1, 1, 0.02);
    const sunMat = this.sunDisc.material as THREE.MeshBasicMaterial;
    sunMat.fog = false;
    sunMat.depthWrite = false;
    sunMat.toneMapped = false;
    this.sunDisc.renderOrder = -8;
    this.scene.add(this.sunDisc);

    this.hillsBackdrop = this.litBillboard(this.art.hills[0]!, 44, 3.3, 0.06, true);
    this.hillsBackdrop.userData['bb'] = 1;
    this.scene.add(this.hillsBackdrop);

    for (let i = 0; i < 4; i += 1) {
      const mesh = this.litBillboard(this.art.bird, 0.55, 0.32, 0.12);
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
      const mesh = this.litBillboard(this.art.deadTree[0]!, 1.5, 2.1, 0.2);
      this.farTrees.push(mesh);
      this.scene.add(mesh);
    }

    for (let i = 0; i < 10; i += 1) {
      const tex = this.art.parallaxIslands[i % this.art.parallaxIslands.length]!;
      const mesh = this.litBillboard(tex, 7.2, 5.2, 0.06, true);
      const mat = mesh.material as THREE.ShaderMaterial;
      mat.depthWrite = false;
      mat.toneMapped = false;
      litOpacity(mat).value = 0.97 - (i % 4) * 0.06;
      mesh.renderOrder = -2;
      mesh.userData['bb'] = 1;
      this.scene.add(mesh);
      this.parallaxIslands.push({
        mesh,
        spread: (i - 4.5) * 11 + ((i * 5) % 7) * 1.4,
        depth: 34 + (i % 5) * 9 + Math.floor(i / 2) * 5,
        altitude: 7.5 + (i % 5) * 1.6,
        parallax: 0.14 + (i % 5) * 0.05,
        bobPhase: i * 1.37,
        size: 0.55 + (i % 3) * 0.1,
      });
    }

    this.cloud = this.litBillboard(this.art.cloud.idle, 4.6, 3.0, 0.12);
    const cloudMat = this.cloud.material as THREE.ShaderMaterial;
    cloudMat.toneMapped = false;
    // The cloud is the player's avatar: a tree, the hero canopy or a ridge must
    // never hide the thing that is pouring the rain.
    cloudMat.depthTest = false;
    cloudMat.depthWrite = false;
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
            vec3 cool = mix(vec3(0.28, 0.72, 1.0), vec3(0.85, 0.98, 1.0), body);
            vec3 silver = mix(vec3(0.72, 0.88, 1.0), vec3(0.95, 0.98, 1.0), body);
            vec3 col = mix(cool, silver, uSilver);
            col = mix(col, vec3(1.0), spark);
            float alpha = (0.5 * body + streak * 0.6 + spark * 0.85) * fade;
            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    );
    this.curtain.userData['bb'] = 1;
    this.curtain.renderOrder = 3;
    this.curtain.visible = false;
    this.scene.add(this.curtain);

    // The rain ring is a flat marker that hovers at the height of the tallest
    // block under the cloud, so it reads as one clean circle on any island.
    this.rainRing = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        // The ring is a marker, not scenery: it stays whole even when a tree
        // or a ridge stands between it and the camera.
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uHalf: { value: 1 },
          uReach: { value: 1 },
          uOn: { value: 0 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uHalf;
          uniform float uReach;
          uniform float uOn;
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float d = length(p) * uHalf;
            float reach = max(uReach, 0.001);
            float rim = smoothstep(reach * 1.04, reach * 0.9, d) * smoothstep(reach * 0.7, reach * 0.9, d);
            float wash = smoothstep(reach, reach * 0.08, d);
            vec3 ring = vec3(0.62, 1.0, 0.82);
            float a = (wash * 0.16 + rim * 0.95) * uOn;
            if (a <= 0.002) discard;
            gl_FragColor = vec4(ring * a, a);
          }
        `,
      }),
    );
    this.rainRing.renderOrder = 6;
    this.rainRing.visible = false;
    this.scene.add(this.rainRing);

    // The thirst auras: a pool of light on the patches that still need water.
    const auraRing = this.glowTexture('aura');
    const auraWisp = this.glowTexture('wisp');
    for (let i = 0; i < AURA_COUNT; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: auraRing,
          color: '#8fe0ff',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.set(0, 0, 0);
      ring.renderOrder = 5;
      ring.visible = false;
      this.scene.add(ring);
      const wisp = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: auraWisp,
          color: '#dff4ff',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      wisp.userData['bb'] = 1;
      wisp.renderOrder = 6;
      wisp.visible = false;
      this.scene.add(wisp);
      this.auras.push({ ring, wisp });
    }

    // An arrow at the screen edge that points at the nearest thirsty patch.
    const arrowGeo = new THREE.BufferGeometry();
    arrowGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0.5, 0, -0.4, -0.34, 0, 0.4, -0.34, 0], 3),
    );
    this.aimArrow = new THREE.Mesh(
      arrowGeo,
      new THREE.MeshBasicMaterial({
        color: '#dff4ff',
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.aimArrow.renderOrder = 40;
    this.aimArrow.visible = false;
    this.scene.add(this.aimArrow);

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
    // The composer renders offscreen, so the renderer's own antialias is lost.
    // Multisampling the target brings the edges back.
    this.composer.renderTarget1.samples = 4;
    this.composer.renderTarget2.samples = 4;
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Only the things that are really bright may glow: the sun disc, the
    // praise shafts, the fireflies. A low threshold lets the whole sunset sky
    // bleed over the island and wash it out.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.62, 1.0);
    this.composer.addPass(this.bloom);
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
    if (import.meta.env.DEV) {
      (window as unknown as { __rain?: RainGame }).__rain = this;
    }
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
    this.audio.useBed('field');
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

  orbitCamera(delta: number): void {
    if (this.globe) return;
    this.camYaw += delta;
  }

  zoomCamera(delta: number): void {
    this.setCamZoom(this.camZoom + delta);
  }

  skipFinale(): void {
    const state = this.state;
    if (!state || state.phase !== 'finale') return;
    state.endFinale();
    this.finaleT = FINALE_DURATION;
    this.pushHud(true);
    void this.saveNow();
  }

  openWorkshop(): void {
    if (this.state) {
      this.workshopSnap = { scale: this.state.scale(), reach: this.state.reach() };
    }
    this.state?.openWorkshop();
    this.audio.useBed('workshop');
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

  getUnlocked(): number {
    return this.state?.unlocked ?? 0;
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

  private fireAbility(cast: AbilityId, state: SaveState): void {
    this.abilityVfx.play(cast, this.cloudX, this.groundY(this.cloudX, this.cloudZ), this.cloudZ, state.reach());
    if (cast === 'lightning') {
      this.audio.zap();
      this.shake = 0.4;
      this.flashBolt(this.nearestTile());
    }
    if (cast === 'sprinkler' || cast === 'whirlpool') {
      this.spin = 0.48;
      this.burst(this.cloudX, 1.3, this.cloudZ, 10);
    }
    if (cast === 'waterbomb' || cast === 'geyser') this.shake = Math.max(this.shake, 0.32);
    this.grin = Math.max(this.grin, 0.38);
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
      this.spawnTornado(false);
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
    this.pushHud(true);
  }

  /** The effects volume, 0 to 1. */
  setSfxVolume(volume: number): void {
    if (!this.state) return;
    this.state.sfxVolume = Math.max(0, Math.min(1, volume));
    this.audio.setSfxVolume(this.state.sfxVolume);
    this.pushHud(true);
    void this.saveNow();
  }

  /** The music volume, 0 to 1. */
  setMusicVolume(volume: number): void {
    if (!this.state) return;
    this.state.musicVolume = Math.max(0, Math.min(1, volume));
    this.audio.setMusicVolume(this.state.musicVolume);
    this.pushHud(true);
    void this.saveNow();
  }

  async reset(): Promise<void> {
    await clearProgress();
    this.state = SaveState.fresh();
    this.state.openStart();
    this.audio.setMuted(!this.state.sfx);
    this.audio.setSfxVolume(this.state.sfxVolume);
    this.audio.setMusicVolume(this.state.musicVolume);
    this.rebuild();
    this.dropCloud(this.spawnAt());
    this.pushHud(true);
  }

  /** Dev-only: what the player really earned, bottle by bottle. */
  analytics(): { version: number; runs: unknown[] } {
    return this.state ? this.state.analytics() : { version: 1, runs: [] };
  }

  /** Dev-only visual QA hooks (scripts/shot.mjs); no-ops in production builds. */
  devJump(world: number, soak: number): void {
    if (!import.meta.env.DEV || !this.state) return;
    this.skipSave = true;
    this.state.unlocked = Math.max(this.state.unlocked, world);
    this.state.screen = 'play';
    if (world !== this.state.world) this.goto(world);
    this.devSoak(soak);
  }

  devSoak(pct: number): void {
    const state = this.state;
    if (!import.meta.env.DEV || !state) return;
    state.devSoak(pct);
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
    // Every boot opens on the world picker: the player picks a land, then it rains.
    this.state.openStart();
    if (fresh) await this.saveNow();
    this.lastPhase = this.state.phase;
    this.audio.setMuted(!this.state.sfx);
    this.audio.setSfxVolume(this.state.sfxVolume);
    this.audio.setMusicVolume(this.state.musicVolume);
    void this.loadMainMusic();
    void this.loadFieldSounds();
    this.rebuild();
    this.dropCloud(this.spawnAt());
    this.pushHud(true);
    this.frame = requestAnimationFrame(this.loop);
  }

  /** Lost in Space over the islands. Sketchbook inside the workshop. */
  private async loadMainMusic(): Promise<void> {
    if (!this.state || this.dead) return;
    try {
      const [field, workshop] = await Promise.all([
        this.loadMusicClip('lost-in-space'),
        this.loadMusicClip('sketchbook'),
      ]);
      if (!this.state || this.dead) return;
      if (field) this.audio.setBed('field', field);
      if (workshop) this.audio.setBed('workshop', workshop);
      this.audio.useBed(this.state.screen === 'workshop' ? 'workshop' : 'field');
      if (this.state.music && !this.audio.musicOn) this.audio.toggleMusic();
    } catch (err) {
      console.warn('Music failed to load', err);
    }
  }

  private async loadFieldSounds(): Promise<void> {
    const load = async (id: string): Promise<AudioBuffer | null> => {
      try {
        return await this.loadMusicClip(id);
      } catch (err) {
        console.warn('Rain clip failed', id, err);
        return null;
      }
    };
    const drops = await Promise.all([
      load('audio/foley-sounds/water/drip1'),
      load('audio/foley-sounds/water/drip2'),
      load('audio/foley-sounds/water/drip3'),
      load('audio/foley-sounds/water/drip4'),
      load('audio/environment/water_drop_medium'),
    ]);
    if (this.dead) return;
    const clips = drops.filter((clip): clip is AudioBuffer => !!clip);
    if (clips.length) this.audio.setDrops(clips);
  }

  private async loadMusicClip(id: string): Promise<AudioBuffer | null> {
    const pack = await loadStowKitPack('default', this.renderer);
    const listener = new THREE.AudioListener();
    this.camera.add(listener);
    try {
      const clip = await pack.loadAudio(id, listener);
      if (clip.isPlaying) clip.stop();
      return clip.buffer ?? null;
    } finally {
      this.camera.remove(listener);
    }
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
    if (state.screen === 'start') {
      // The world picker holds the world still until a land is chosen.
      this.audio.rainStop();
      return;
    }
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
        const yaw = this.camYaw;
        const camOffX = Math.sin(yaw);
        const camOffZ = Math.cos(yaw);
        const fwdX = -camOffX;
        const fwdZ = -camOffZ;
        const rightX = camOffZ;
        const rightZ = -camOffX;
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
    if (this.syncRunPhase()) return;
    if (raining && !this.audio.muted) {
      this.audio.rainStart();
      this.audio.setRainHum(state.ranks.hum >= 1);
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
      state.flowWaterStep();
      splashDew += hit.dew;
      splashCrits += hit.crits;
      if (hit.filled > 0) {
        this.grin = 0.75;
        // Every patch that comes back makes a small sound, so a busy bottle has a
        // texture instead of silence.
        this.audio.restore();
      }
      if (hit.crits > 0) this.audio.crit();
      const cast = state.tryCastAbility({
        cloudX: this.cloudX,
        cloudZ: this.cloudZ,
        faceX: this.faceX,
        faceZ: this.faceZ,
        velX: this.cloudX - this.prevX,
        velZ: this.cloudZ - this.prevZ,
      });
      if (cast) this.fireAbility(cast, state);
    }
    state.tryCompleteIsland();
    if (this.syncRunPhase()) return;
    if (splashDew >= 0.05) {
      const label =
        splashCrits > 0
          ? `CRIT +${formatSplashDew(splashDew)}`
          : `+${formatSplashDew(splashDew)}`;
      this.floatText(this.cloud.position.x, this.cloud.position.y + 0.45, label, splashCrits > 0);
    }

    if (
      raining &&
      !this.tornado &&
      state.tornadoCd <= 0 &&
      ABILITIES.tornado.enabled(state.ranks, state.world) &&
      state.startTornado()
    ) {
      this.spawnTornado(state.consumeLifeStorm());
      this.audio.zap();
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
        state.stampWaveAt(this.tornado.x, this.tornado.z, 1.1);
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
    this.stepCameraInput(dt);
    const vx = this.cloudX - this.cloud.position.x;
    const vz = this.cloudZ - this.cloud.position.z;
    const lean = -(vx * Math.cos(YAW) - vz * Math.sin(YAW));
    const inFinale = state.phase === 'finale';
    const sleepy = state.tank <= 0.01 && !inFinale;
    const raining = this.wantsRain() && !sleepy && !this.introActive && !inFinale;
    this.rainMix += ((raining ? 1 : 0) - this.rainMix) * Math.min(1, dt * 2.2);
    const blink = Math.sin(t * 0.65) > 0.965;
    const mood: CloudMood = inFinale
      ? 'grin'
      : sleepy
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
    const mat = this.cloud.material as THREE.ShaderMaterial;
    if (mood !== this.mood) {
      setLitMap(mat, this.art.cloud[mood]);
      this.mood = mood;
    }
    const bow = state.ranks.bow >= 1;
    litColor(mat).set(sleepy ? '#c5c9d4' : bow ? '#fff4fc' : '#ffffff');
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
    const blush = state.ranks.blush >= 1 ? 1.06 : 1;
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
      const targetY = gy + CLOUD_CLEARANCE + CLOUD_LIFT * grown;
      this.hoverY += (targetY - this.hoverY) * lift;
      this.camGroundY += (gy - this.camGroundY) * (1 - Math.exp(-dt * 2.4));
      this.cloud.position.y = this.hoverY + bob;
    }
    this.spin = Math.max(0, this.spin - dt);
    const twirl = this.spin > 0 ? (1 - this.spin / 0.48) * Math.PI * 2 : 0;
    this.cloud.userData['roll'] = clamp(lean * 0.7, -0.28, 0.28) + twirl;

    const curtainMat = this.curtain.material as THREE.ShaderMaterial;
    curtainMat.uniforms['uTime']!.value = t;
    curtainMat.uniforms['uSilver']!.value = state.ranks.trail >= 1 ? 1 : 0;
    this.curtain.visible = raining;
    this.puddle.visible = false;
    for (const mat of this.maskMats) {
      if (!mat.uniforms['uSeek']) continue;
      if (state.phase === 'finale') {
        mat.uniforms['uSeek'].value = 0;
      } else {
        const ratio = state.ratio();
        const seek = clamp((ratio - 0.7) / 0.12, 0, 1);
        const fade = 1 - clamp((ratio - 0.84) / 0.1, 0, 1);
        mat.uniforms['uSeek'].value = seek * fade * 0.55;
      }
    }
    this.updateRainRing(raining, state.reach());
    this.updateAuras(t, dt);
    if (raining) {
      const reach = state.reach();
      const gy = this.globe ? this.cloud.position.y - 1.6 : this.groundY(this.cloudX, this.cloudZ);
      const ground = gy - 0.18;
      const cloudBase = this.cloud.position.y - 0.35 * grown;
      const tall = Math.max(0.9, cloudBase - ground);
      const wide = Math.max(reach * 3.6, 4.4 * grown);
      const mat = this.curtain.material as THREE.ShaderMaterial;
      mat.uniforms['uTop']!.value = Math.min(1, (2.0 * grown) / wide);
      mat.uniforms['uDensity']!.value = Math.min(0.75, state.patch() + 0.15);
      this.curtain.scale.set(wide, tall, 1);
      this.curtain.position.set(this.cloud.position.x, ground + tall / 2, this.cloud.position.z);
      this.puddle.position.set(this.cloud.position.x, gy + 0.06, this.cloud.position.z);
      this.puddle.scale.setScalar(reach * (1 + Math.sin(t * 8) * 0.03));
    }

    this.placeCamera(dt);
    this.dressSky(t);
    this.updateTiltCloudMask();

    this.dropAcc += dt;
    if (raining && this.dropAcc > state.dropEvery() * 0.5) {
      this.dropAcc = 0;
      const specks = 2 + Math.floor(state.ranks.specks / 2);
      for (let i = 0; i < specks; i += 1) this.launchDrop();
    }
    for (const drop of this.drops) {
      if (!drop.alive) continue;
      drop.y -= drop.vy * dt;
      drop.mesh.position.x += drop.vx * dt;
      drop.mesh.position.z += drop.vz * dt;
      drop.vx *= 1 - dt * 2.2;
      drop.vz *= 1 - dt * 2.2;
      drop.mesh.position.y = drop.y;
      const floor = this.globe ? 0.2 : this.groundY(drop.mesh.position.x, drop.mesh.position.z) + 0.05;
      if (drop.y < floor) {
        drop.alive = drop.mesh.visible = false;
      }
    }

    state.fadeRipples(dt);
    state.decayPulse(dt);
    state.tickRestorationWaves(dt);
    this.drainFanfare();
    if (
      state.maskDirty ||
      !this.maskTex ||
      inFinale ||
      (this.wantsRain() && state.phase === 'play' && state.tank > 0.01)
    ) {
      this.syncMask();
    }
    if (state.pulseDirty || !this.pulseTex) this.syncPulse();
    this.abilityVfx.update(dt);
    for (const pulse of state.takeGrowthPulses()) {
      this.burst(pulse.x, 1.05, pulse.z, 6 + pulse.stage * 2);
      this.audio.grow();
    }
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

    if (inFinale) this.updateWorldFinale(dt, t);

    this.applySkyLift(dt);
    this.faceAll();
    this.syncProps(t);
    this.syncCritters(dt, t);
    this.stepAmbient(dt, t);
    this.stepFx(dt);
  }

  /** Returns true when play-phase simulation should stop (finale / dry / clear). */
  private syncRunPhase(): boolean {
    const state = this.state;
    if (!state) return true;
    const phaseNow: RunPhase = state.phase;
    if (phaseNow === this.lastPhase) return phaseNow !== 'play';
    if (phaseNow === 'finale') this.startWorldFinale();
    if (phaseNow !== 'play') {
      this.pushHud(true);
      void this.saveNow();
    }
    this.lastPhase = phaseNow;
    return phaseNow !== 'play';
  }

  private startWorldFinale(): void {
    const state = this.state;
    if (!state) return;
    this.finaleT = 0;
    this.finaleHudAcc = 0;
    this.skyLift = 5.2;
    this.shake = 0.52;
    this.grin = 1.2;
    this.cloudPop = 1.38;
    this.camZoomPulse = 0;
    this.finaleCamYaw0 = this.camYaw;
    this.finaleCamZoom0 = this.camZoom;
    const focal = state.islandFocal();
    this.finaleFocalX = focal.x;
    this.finaleFocalZ = focal.z;
    this.camX = focal.x;
    this.camZ = focal.z;
    this.audio.victory();
    const reach = state.reach();
    const cx = focal.x;
    const cz = focal.z;
    for (let i = 0; i < this.views.length; i += 1) {
      const view = this.views[i];
      if (!view) continue;
      if (!view.dressed) this.dressTile(i);
      else {
        view.growStart = this.clock.elapsedTime;
        view.growT = 0;
      }
      const at = this.tilePos(i);
      this.burst(at.x, 1.15, at.z, 12);
      state.stampWaveAt(at.x, at.z, 1.35);
      this.rippleAt(at.x, at.z, '#9ed86a');
    }
    state.maskDirty = true;
    state.pulseDirty = true;
    this.abilityVfx.play('rainbow', cx, 2.4, cz, reach * 1.6);
    this.abilityVfx.play('purify', cx, 1.2, cz, reach * 1.2);
    this.floatText(cx, 2.6, 'The land breathes again', false);
    this.syncCritters(0, 0, true);
  }

  private updateWorldFinale(dt: number, t: number): void {
    const state = this.state;
    if (!state || state.phase !== 'finale') return;
    const prev = this.finaleT;
    this.finaleT += dt;
    state.finaleProgress = Math.min(1, this.finaleT / FINALE_DURATION);
    this.shake = Math.max(0, 0.42 * (1 - this.finaleT / 1.4));
    const focal = state.islandFocal();
    const cx = focal.x;
    const cz = focal.z;
    const reach = state.reach();
    const camPull = 1 - Math.pow(0.001, dt);
    this.camX += (cx - this.camX) * camPull;
    this.camZ += (cz - this.camZ) * camPull;
    const waveEase = smoothstep(state.finaleProgress);
    const waveR = state.islandCoverRadius() * waveEase;
    if (state.applyFinaleWave(cx, cz, waveR) > 0) {
      this.syncMask();
      this.syncPulse();
      for (let i = 0; i < this.views.length; i += 1) {
        if (state.isRestored(i) && this.views[i] && !this.views[i]!.dressed) this.dressTile(i);
      }
    }
    if (prev < 1.1 && this.finaleT >= 1.1) {
      this.audio.bloom();
      this.abilityVfx.play('monsoon', cx, 2.8, cz, reach * 1.4);
      this.floatText(cx, 2.2, 'Wildlife returns', false);
      this.syncCritters(0, t, true);
    }
    if (prev < 2.6 && this.finaleT >= 2.6) {
      this.abilityVfx.play('spore', cx, 1.4, cz, reach);
      this.shake = 0.18;
    }
    const tick = Math.floor(this.finaleT * 2.2);
    const prevTick = Math.floor(prev * 2.2);
    if (tick !== prevTick) {
      const spots = this.restoredSpots();
      const idx = spots[tick % Math.max(1, spots.length)] ?? 0;
      const at = this.tilePos(idx);
      this.burst(at.x, 1.25, at.z, 10);
      this.rippleAt(at.x, at.z, '#b6f27a');
    }
    this.finaleHudAcc += dt;
    if (this.finaleHudAcc > 0.12) {
      this.finaleHudAcc = 0;
      this.pushHud(false);
    }
    if (state.finaleProgress >= 0.92 && prev / FINALE_DURATION < 0.92) {
      state.sealFinaleLandscape();
      this.syncMask();
      this.syncPulse();
      this.syncProps(t);
      for (let i = 0; i < this.views.length; i += 1) {
        if (this.views[i] && !this.views[i]!.dressed) this.dressTile(i);
      }
    }
    if (this.finaleT >= FINALE_DURATION) {
      state.endFinale();
      this.pushHud(true);
      void this.saveNow();
      this.lastPhase = state.phase;
      this.shake = 0.15;
    }
  }

  private applySkyLift(dt: number): void {
    if (this.skyLift > 0) this.skyLift = Math.max(0, this.skyLift - dt);
    if (this.globe) return;
    const lift = this.skyLift > 0 ? (this.skyLift / 5.2) * 0.3 : 0;
    const fog = this.scene.fog as THREE.Fog | null;
    if (fog) {
      const c = this.fogBase.clone();
      c.r = clamp(c.r + lift, 0, 1);
      c.g = clamp(c.g + lift * 0.9, 0, 1);
      c.b = clamp(c.b + lift * 0.55, 0, 1);
      c.r *= 1 - this.rainMix * 0.16;
      c.g *= 1 - this.rainMix * 0.09;
      c.b = c.b * (1 - this.rainMix * 0.02) + this.rainMix * 0.03;
      fog.color.copy(c);
    }
    this.skyMat.uniforms['uRain']!.value = this.rainMix;
  }


  private rebuild(): void {
    const state = this.state;
    if (!state) return;
    this.animals = [];
    this.boxes = [];
    for (const fall of this.waterfalls) {
      this.track.remove(fall.fall);
      this.track.remove(fall.mist);
      this.track.remove(fall.stream);
    }
    this.waterfalls = [];
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
    this.camYaw = 0;
    const skyMid = worldDef(world).skyMid;
    const sky = worldDef(world);
    this.propDusk.set(sky.skyMid);
    this.propSun.set('#fff1e4');
    if (this.globe) {
      this.scene.background = new THREE.Color('#24356e');
    } else {
      this.scene.background = new THREE.Color(sky.skyMid);
    }
    this.skyBase.set(skyMid);
    // The haze the far land fades into is deeper than the sky itself, so the
    // distance sinks away instead of glowing. The band also starts further
    // out: at 1.5x the frame distance the whole island was inside the fog
    // and the land lost its colour.
    this.fogBase.set(skyMid).lerp(new THREE.Color(sky.skyTop), 0.45);
    const dist = this.frameDist(0);
    if (this.globe) {
      this.scene.fog = new THREE.Fog('#24356e', 18, 48);
    } else {
      const fog = new THREE.Fog(dist * 2.4, dist * 7.5);
      fog.color.copy(this.fogBase);
      this.scene.fog = fog;
    }
    (this.skyMat.uniforms['uTop']!.value as THREE.Color).set(sky.skyTop);
    (this.skyMat.uniforms['uMid']!.value as THREE.Color).set(sky.skyMid);
    (this.skyMat.uniforms['uBot']!.value as THREE.Color).set(sky.skyBot);
    this.skyDome.visible = !this.globe;
    this.spaceDome.visible = this.globe;
    this.atmo.visible = this.globe;
    if (this.globe) {
      this.spaceDome.position.set(0, 0, 0);
      this.atmo.position.set(0, 0, 0);
      this.atmo.renderOrder = -6;
    }
    this.sunDisc.visible = false;
    this.sunHalo.visible = false;
    this.rainbow.visible = false;
    this.mist.visible = false;
    this.mountain.visible = false;
    for (const peak of this.peaks) peak.visible = false;
    this.hillsBackdrop.visible = false;
    this.hillsFar.visible = false;
    for (const tree of this.farTrees) tree.visible = false;
    for (let i = 0; i < this.parallaxIslands.length; i += 1) {
      const isl = this.parallaxIslands[i]!;
      isl.mesh.visible = !this.globe;
      const map = this.art.parallaxIslands[(world + i) % this.art.parallaxIslands.length]!;
      setLitMap(isl.mesh.material as THREE.ShaderMaterial, map);
      litColor(isl.mesh.material as THREE.ShaderMaterial).set(worldDef(world).skyMid);
    }
    const hillTex = this.art.hills[world] ?? this.art.hills[0]!;
    const nearMat = this.hillsBackdrop.material as THREE.ShaderMaterial;
    setLitMap(nearMat, hillTex);
    litColor(nearMat).setRGB(0.46, 0.26, 0.34);
    litOpacity(nearMat).value = 1;
    const farMat = this.hillsFar.material as THREE.ShaderMaterial;
    setLitMap(farMat, hillTex);
    litColor(farMat).setRGB(0.28, 0.16, 0.22);
    litOpacity(farMat).value = 0.72;
    for (const m of this.ambient) {
      m.mesh.position.set(
        (this.terrain?.originX ?? -13) + Math.random() * (this.terrain?.width ?? 26),
        1 + Math.random() * 4,
        (this.terrain?.originZ ?? -10) + Math.random() * (this.terrain?.depth ?? 20),
      );
      m.mesh.visible = false;
    }

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
    this.pulseTex = this.makePulse(state.pulse, maskSize.cols, maskSize.rows);
    this.maskMats = [];
    this.terrain = null;
    let voxelMat: THREE.ShaderMaterial | null = null;
    const terrain = new Terrain(world);
    this.terrain = terrain;
    const fog = this.scene.fog as THREE.Fog;
    const ground = terrain.buildMesh(
      this.maskTex,
      this.pulseTex,
      maskSize,
      this.timeU,
      fog,
      this.sunDir,
      this.sunColor,
      this.cloudShadow,
      this.rainUniform,
    );
    voxelMat = ground.material as THREE.ShaderMaterial;
    this.maskMats.push(voxelMat);
    this.track.add(ground);
    if (!this.globe) {
      const flora = terrain.buildFlora(
        art.floraByWorld[world] ?? art.flora,
        this.maskTex,
        this.pulseTex,
        maskSize,
        this.timeU,
        fog,
        this.sunDir,
        this.sunColor,
      );
      this.maskMats.push(flora.material as THREE.ShaderMaterial);
      this.track.add(flora);
    }
    const tiles = state.current();
    this.buildPropShadows(tiles.length);
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
          growT: restored ? 1 : 0,
          growStart: 0,
          stage: -1,
          offIsland: false,
          pondWater: null,
          pondLily: [],
          pondFrog: null,
          pondFill: restored ? 1 : 0,
          pondStage: restored ? 2 : 0,
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
        growT: restored ? 1 : 0,
        growStart: 0,
        stage: -1,
        offIsland: false,
        pondWater: null,
        pondLily: [],
        pondFrog: null,
        pondFill: restored ? 1 : 0,
        pondStage: restored ? 2 : 0,
        x: at.x,
        y: this.globe ? at.y : column,
        z: at.z,
        nx: normal.x,
        ny: normal.y,
        nz: normal.z,
      };
      this.dressView(view, i, restored, world);
    }
    const { backX, backZ } = this.skyAxes();
    const boardX = spanX / 2;
    const boardZ = spanZ / 2;
    const span = Math.max(spanX, spanZ);
    this.hillsBackdrop.position.set(boardX + backX * span * 0.62, 0.35, boardZ + backZ * span * 0.62);
    this.hillsBackdrop.scale.set(span * 1.05, span * 0.32, 1);
    this.farTrees.forEach((tree) => {
      tree.visible = false;
    });

    this.syncBoxes(true);
    this.syncCritters(0, 0, true);
    this.restoreWaterfalls();
  }

  private dressView(view: TileView, index: number, restored: boolean, world: number): void {
    const state = this.state;
    if (!state) return;
    const art = this.art;
    const spec = state.spec(index);
    // Nothing grows in the sea.
    const grid = gridOf(world);
    if (!tileIsLand(world, index % grid.cols, Math.floor(index / grid.cols))) {
      view.prop = null;
      view.pond = null;
      return;
    }
    if (spec.kind === 'pond') {
      const group = new THREE.Group();
      group.userData['bb'] = 1;
      group.visible = !this.globe;
      group.position.set(view.x + view.nx * 0.3, view.y + view.ny * 0.3, view.z + view.nz * 0.3);
      const basin = this.sprite(restored ? art.pondFull : art.pondEmpty, 2.4, 1.3, 0.25, 0);
      group.add(basin);
      // billboards are flipped by faceAll, so layers stack toward -Z
      const water = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.04), makePondWater(this.timeU, this.sunDir, this.sunColor, this.rainUniform));
      water.position.z = -0.02;
      water.visible = false;
      group.add(water);
      const lily0 = this.sprite(art.lilyPad, 0.76, 0.57, 0.06, -0.05);
      lily0.position.set(-0.58, -0.08, -0.05);
      lily0.visible = false;
      group.add(lily0);
      const lily1 = this.sprite(art.lilyPadFlower, 0.6, 0.45, 0.06, -0.05);
      lily1.position.set(0.58, 0.1, -0.05);
      lily1.visible = false;
      group.add(lily1);
      const frog = this.sprite(art.frog, 0.52, 0.45, 0.08, -0.08);
      frog.visible = false;
      group.add(frog);
      const koi = this.sprite(art.koi, 0.62, 0.36, 0.08, -0.035);
      koi.visible = false;
      group.add(koi);
      this.track.add(group);
      view.pond = basin;
      view.pondWater = water;
      view.pondLily = [lily0, lily1];
      view.pondFrog = frog;
      view.koi = koi;
      view.pondFill = restored ? 1 : 0;
      view.pondStage = restored ? 2 : 0;
      if (restored) {
        water.visible = true;
        water.scale.setScalar(1);
        lily0.visible = true;
        lily1.visible = true;
        frog.visible = true;
        koi.visible = true;
      }
    }
    const flat = !this.globe;
    const wet = state.hillWet(index);
    const step = spec.kind === 'seed' ? (restored ? 2 : 0) : restored ? 2 : this.propStep(spec.decor, wet);
    view.stage = step;
    view.prop =
      flat && spec.decor === 'twig' && spec.kind !== 'seed'
        ? null
        : spec.kind === 'seed'
          ? this.anchorAtBase(this.litBillboard(restored ? art.money : art.seed, 1.15, 1.7, 0.2))
          : this.propMesh(spec.decor, world, index);
    if (view.prop) {
      const map =
        spec.kind === 'seed'
          ? restored
            ? art.money
            : art.seed
          : this.propTexture(spec.decor, step, world, index);
      setLitMap(view.prop.material as THREE.ShaderMaterial, map);
      litColor(view.prop.material as THREE.ShaderMaterial).copy(restored ? this.propSun : this.propDusk);
      if (flat) {
        const jx = (((index * 37) % 11) / 11 - 0.5) * TILE * 0.5;
        const jz = (((index * 53) % 13) / 13 - 0.5) * TILE * 0.5;
        view.x += jx;
        view.z += jz;
        view.y = this.groundY(view.x, view.z);
      }
      const base = this.propBase(spec.decor, step, index);
      const resting = spec.kind === 'seed' ? base : base * (restored ? 1 : clamp(0.34 + wet * 0.8, 0.34, 0.98));
      view.prop.userData['s'] = base;
      view.prop.scale.setScalar(resting);
      const ph = (Number(view.prop.userData['ph']) || 1) * view.prop.scale.y;
      // The sprite pivots at its feet, so it stands on the ground and the wind
      // bends it from the base up.
      view.prop.position.set(view.x + view.nx * 0.08, view.y + view.ny * 0.08, view.z + view.nz * 0.08);
      // Tall billboards are pushed out along the surface normal, so an edge tile
      // can hang the sprite over the void: test the displaced spot, not the tile.
      if (flat && this.terrain && spec.kind !== 'seed') {
        const foot = this.terrain.shoreAt(view.x, view.z);
        const crown = this.terrain.shoreAt(view.x + view.nx * ph * 0.35, view.z + view.nz * ph * 0.35);
        view.offIsland = foot > 0.012 || crown > 0.02;
      }
      view.prop.visible = !this.globe && !view.offIsland && (restored || wet > 0.14 || spec.kind === 'seed');
      this.track.add(view.prop);
    }
    if (restored && spec.kind === 'seed' && view.prop) view.prop.userData['s'] = 1.25;
    this.views.push(view);
  }

  /** Lakes that are already full keep spilling over the edge. */
  private restoreWaterfalls(): void {
    const state = this.state;
    if (!state) return;
    for (let i = 0; i < this.views.length; i += 1) {
      const view = this.views[i];
      if (!view || view.pondStage < 2) continue;
      if (state.spec(i).kind !== 'pond') continue;
      this.spawnWaterfall(view, i);
    }
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
    view.growStart = this.clock.elapsedTime;
    view.growT = 0;
    if (view.pond) (view.pond.material as THREE.MeshBasicMaterial).map = art.pondFull;
    if (view.bar) view.bar.visible = false;
    if (view.prop) {
      const map = spec.kind === 'seed' ? art.money : this.propTexture(spec.decor, 2, world, index);
      setLitMap(view.prop.material as THREE.ShaderMaterial, map);
      litColor(view.prop.material as THREE.ShaderMaterial).copy(this.propSun);
      if (spec.kind === 'seed') view.prop.userData['s'] = 1.25;
      view.stage = 2;
    }
    if (spec.kind === 'pond') {
      if (view.pondWater) {
        view.pondWater.visible = true;
        view.pondWater.scale.setScalar(1);
      }
      for (const lily of view.pondLily) lily.visible = true;
      if (view.pondFrog) view.pondFrog.visible = true;
      if (view.koi) view.koi.visible = true;
      view.pondFill = 1;
      view.pondStage = 2;
    }
    if (view.koi) view.koi.visible = spec.kind === 'pond';
  }

  private onBloom(index: number, result: SoakResult): void {
    const view = this.views[index];
    if (view && !view.dressed) this.dressTile(index);
    const at = view ? { x: view.x, z: view.z } : this.tilePos(index);
    this.rippleAt(at.x, at.z, result.mega ? '#ffe56a' : '#b6f27a');
    this.burst(at.x, 1.1, at.z, result.mega ? 28 : 20);
    this.burst(at.x, 1.6, at.z, 10);
    this.shake = Math.max(this.shake, 0.28);
    this.grin = 0.7;
    this.floatText(at.x, 1.8, result.pond ? 'Pond!' : 'Life takes root', false);
    if (result.dew > 0) {
      this.floatText(at.x, 1.35, result.crit ? `CRIT +${Math.floor(result.dew)}` : `+${Math.floor(result.dew)}`, result.crit);
    }
    if (result.pond) {
      this.audio.splash();
      this.leapKoi(index);
    } else if (result.bloomed) this.audio.bloom();
    // Bloom Sparkle: little glints rising off the new growth.
    if (this.state && this.state.ranks.sparkle >= 1) {
      for (let i = 0; i < 5; i += 1) {
        const mote = this.takeMote(this.art.spark);
        if (!mote) break;
        mote.mesh.position.set(at.x + (Math.random() - 0.5) * 0.9, 1.2, at.z + (Math.random() - 0.5) * 0.9);
        mote.life = 1.1;
        mote.vy = 1.9;
        mote.vx = (Math.random() - 0.5) * 0.5;
        mote.vz = (Math.random() - 0.5) * 0.5;
      }
    }
    if (result.mega) this.shake = 0.55;
    this.syncCritters(0, 0, true);
  }

  private syncProps(t: number): void {
    const state = this.state;
    if (!state) return;
    this.syncBoxes(false);
    const shadows = this.propShadows;
    let shadowIndex = 0;
    for (let i = 0; i < this.views.length; i += 1) {
      const view = this.views[i];
      const tile = state.current()[i];
      if (!view || !tile) continue;
      const spec = state.spec(i);
      const wet = state.hillWet(i);
      const restored = state.isRestored(i);
      const gust = this.gustAt(view.x, view.z, t);
      if (spec.kind === 'pond') {
        const fill = state.pondFill(i);
        view.pondFill = fill;
        const stage = fill >= 0.985 ? 2 : fill >= 0.45 ? 1 : 0;
        if (stage > view.pondStage) {
          view.pondStage = stage;
          if (stage === 1) {
            this.burst(view.x, view.y + 0.35, view.z, 6);
          } else {
            this.burst(view.x, view.y + 0.45, view.z, 12);
            this.rippleAt(view.x, view.z, '#bfeaff');
            this.audio.splash();
            // The lake is full: it spills over the edge of the world.
            this.spawnWaterfall(view, i);
          }
        }
        if (view.pondWater) {
          view.pondWater.visible = fill > 0.02;
          const grow = clamp(0.12 + fill * 0.95, 0.12, 1);
          view.pondWater.scale.set(grow, grow, 1);
          view.pondWater.position.y = Math.sin(t * 1.25 + i) * 0.012;
        }
        const lily0 = view.pondLily[0];
        const lily1 = view.pondLily[1];
        if (view.pond) {
          (view.pond.material as THREE.MeshBasicMaterial).map = restored ? this.art.pondFull : this.art.pondEmpty;
        }
        if (lily0) {
          lily0.visible = fill > 0.5;
          const s = easeOutBack(clamp((fill - 0.5) / 0.28, 0, 1));
          lily0.scale.setScalar(Math.max(0.02, s));
        }
        if (lily1) {
          lily1.visible = fill > 0.76;
          const s = easeOutBack(clamp((fill - 0.76) / 0.2, 0, 1));
          lily1.scale.setScalar(Math.max(0.02, s));
        }
        if (view.pondFrog) {
          const frog = view.pondFrog;
          frog.visible = fill > 0.68;
          if (frog.visible) {
            const cycle = (t + i * 1.7) % 4.6;
            const hop = cycle < 0.85 ? Math.sin((cycle / 0.85) * Math.PI) : 0;
            const wave = Math.sin(t * 2.6 + i);
            frog.position.set(-0.52 + hop * 1.06, -0.05 + hop * 0.36 + wave * 0.015, -0.08);
            frog.rotation.z = hop * 0.6 * Math.sign(1);
            const squash = 1 + Math.sin(t * 3.1 + i) * 0.05;
            frog.scale.set(squash, 2 - squash, 1);
          }
        }
        if (view.koi) {
          const koi = view.koi;
          koi.visible = fill > 0.32;
          if (koi.visible) {
            const swim = t * 0.55 + i;
            koi.position.set(Math.cos(swim) * 0.46, Math.sin(swim * 1.6) * 0.14, -0.035);
            koi.rotation.z = Math.cos(swim) * 0.4;
          }
        }
        if (view.bar && !restored) {
          view.bar.scale.x = Math.max(0.05, fill);
          view.bar.visible = fill < 0.985;
        }
      }
      if (view.prop && spec.kind !== 'seed') {
        let slopeOk = true;
        if (spec.decor === 'tree' && this.terrain) {
          const y0 = this.groundY(view.x, view.z);
          const y1 = this.groundY(view.x + 0.28, view.z);
          const y2 = this.groundY(view.x, view.z + 0.28);
          slopeOk = Math.max(Math.abs(y1 - y0), Math.abs(y2 - y0)) < 0.32;
        }
        view.prop.visible = !this.globe && slopeOk && !view.offIsland && (restored || wet > 0.14);
        const step = restored ? 2 : this.propStep(spec.decor, wet);
        if (step > view.stage) {
          view.stage = step;
          view.growStart = t;
          view.growT = 0;
          view.anim = 1;
          const base = this.propBase(spec.decor, step, i);
          view.prop.userData['s'] = base;
          this.burst(view.x, view.y + 0.4 + step * 0.25, view.z, 4 + step * 2);
        } else if (step < view.stage) {
          view.stage = step;
          view.prop.userData['s'] = this.propBase(spec.decor, step, i);
        }
        if (view.prop.visible) {
          const map = this.propTexture(spec.decor, view.stage, state.world, i);
          const mat = view.prop.material as THREE.ShaderMaterial;
          if (mat.uniforms['uMap']!.value !== map) setLitMap(mat, map);
          const life = restored ? 1 : clamp((wet - 0.12) / 0.72, 0, 1);
          litColor(mat).copy(this.propDusk).lerp(this.propSun, life);
          const base = Number(view.prop.userData['s']) || 1;
          const pop = restored ? 1 : clamp(0.34 + wet * 0.8, 0.34, 0.98);
          if (view.growStart > 0) {
            view.growT = Math.min(1, (t - view.growStart) / 0.85);
            const gy = easeOutBack(view.growT);
            view.prop.scale.set(base * pop * gy, base * pop * Math.max(0.06, gy), base * pop * gy);
          } else {
            view.prop.scale.setScalar(base * pop);
          }
        }
      }
      if (view.prop) {
        // Lean from the feet: the base stays planted, the crown does the moving.
        const sway = restored ? Math.sin(t * 1.6 + i) * 0.045 : Math.sin(t * 1.2 + i) * 0.02;
        view.prop.rotation.z = sway + gust * 0.11;
        view.prop.position.set(
          view.x + view.nx * 0.08 + gust * 0.05,
          view.y + view.ny * 0.08,
          view.z + view.nz * 0.08,
        );
        if (view.prop.visible && shadows && shadowIndex < shadows.instanceMatrix.count) {
          const width = (Number(view.prop.userData['gw']) || 1) * view.prop.scale.x;
          this.shadowPos.set(view.x, view.y + 0.03, view.z);
          this.shadowScale.set(width * 0.78, 1, width * 0.78);
          this.shadowMatrix.compose(this.shadowPos, this.shadowQuat.identity(), this.shadowScale);
          shadows.setMatrixAt(shadowIndex, this.shadowMatrix);
          shadowIndex += 1;
        }
      }
      if (view.pond && view.pondFill > 0 && view.pondFill < 1) {
        view.pond.rotation.z = Math.sin(t * 1.1 + i) * 0.02;
      }
    }
    if (shadows) {
      shadows.count = shadowIndex;
      shadows.instanceMatrix.needsUpdate = true;
    }
  }

  /** 0–1 gust intensity sweeping across the board; shared by shaders, props and wind trails. */
  private gustAt(x: number, z: number, t: number): number {
    const wave = Math.sin(x * 0.16 + z * 0.11 - t * 1.35);
    return clamp((wave - 0.42) / 0.58, 0, 1);
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
      const roster = [this.art.frog, this.art.fox, this.art.fennec, this.art.duck];
      const map = roster[state.world] ?? this.art.frog;
      this.animals = [];
      for (let i = 0; i < want; i += 1) {
        const tex = state.phase === 'finale' ? (roster[i % roster.length] ?? map) : map;
        const mesh = this.billboard(tex, state.phase === 'finale' ? 0.72 : 0.62, state.phase === 'finale' ? 0.58 : 0.52, 0.2);
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
      const step = (state.phase === 'finale' ? 2.4 : 0.85 + ratio * 1.4) * dt;
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

    const flies = state.phase === 'finale' ? 16 : state.ratio() > 0.25 ? 5 : 0;
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

  /** Drifting petals, pollen and leaves that keep the island feeling alive. */
  private stepAmbient(dt: number, t: number): void {
    const state = this.state;
    if (!state) return;
    const show = !this.globe && (state.phase === 'play' || state.phase === 'finale') && state.ratio() > 0.14;
    const spanX = this.terrain ? this.terrain.width : 26;
    const spanZ = this.terrain ? this.terrain.depth : 20;
    const ox = this.terrain ? this.terrain.originX : -13;
    const oz = this.terrain ? this.terrain.originZ : -10;
    for (const m of this.ambient) {
      const mesh = m.mesh;
      if (!show) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.sin(t * 1.3 + m.phase) * 0.14 + this.rainMix * 0.08;
      const gust = this.gustAt(mesh.position.x, mesh.position.z, t);
      mesh.position.x += (m.vx + gust * 1.8) * dt;
      mesh.position.z += (m.vz + Math.sin(t * 0.7 + m.phase) * 0.35) * dt;
      mesh.position.y += (m.vy - this.rainMix * 0.25) * dt;
      mesh.rotation.z += m.spin * dt * 0.6;
      if (mesh.position.y < 0.45) {
        mesh.position.set(ox + Math.random() * spanX, 1.2 + Math.random() * 3.4, oz + Math.random() * spanZ);
      }
      if (mesh.position.x > ox + spanX + 1.5) mesh.position.x = ox - 1.5;
      if (mesh.position.z > oz + spanZ + 1.5) mesh.position.z = oz - 1.5;
      if (mesh.position.z < oz - 1.5) mesh.position.z = oz + spanZ + 1.5;
      if (mesh.position.y > 7.5 || mesh.position.x < ox - 1.6) mesh.position.y = 1.2 + Math.random() * 2.4;
      const depthScale = 0.14 + Math.min(0.1, (m.mesh.position.y - 0.4) * 0.02);
      mesh.scale.setScalar(depthScale / 0.16);
    }
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
    if (!touch) return;
    // First finger flies the cloud, second finger turns the world: two sticks.
    if (!this.stick) {
      this.stick = { id: event.pointerId, x: event.clientX, y: event.clientY, cx: this.cloudX, cz: this.cloudZ };
    } else if (!this.rotateStick) {
      this.rotateStick = { id: event.pointerId, x: event.clientX };
    }
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private onUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.stick && event.pointerId === this.stick.id) this.stick = null;
    if (this.rotateStick && event.pointerId === this.rotateStick.id) this.rotateStick = null;
  };

  private onWheel = (event: WheelEvent): void => {
    const phase = this.state?.phase;
    if (!this.state || (phase !== 'play' && phase !== 'finale')) return;
    event.preventDefault();
    const step = 0.0016;
    const delta = event.deltaY * step;
    this.setCamZoom(this.camZoom * (1 + delta));
  };

  private onMove = (event: PointerEvent): void => {
    if (this.pointers.has(event.pointerId)) {
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    const state = this.state;
    // The second finger is the right stick: push it sideways to turn the world.
    const turn = this.rotateStick;
    if (turn && event.pointerId === turn.id && state && (state.phase === 'play' || state.phase === 'finale')) {
      const dx = event.clientX - turn.x;
      if (Math.abs(dx) > 0.5) {
        this.camYaw += dx * TURN_TOUCH;
        turn.x = event.clientX;
      }
      return;
    }
    if (!this.stick || event.pointerId !== this.stick.id || !state || state.phase !== 'play') return;
    const stick = this.stick;
    if (this.globe) {
      const dx = event.clientX - stick.x;
      const dy = event.clientY - stick.y;
      this.cloudX = stick.cx + dx * 0.005;
      this.cloudZ = clamp(stick.cz - dy * 0.004, -1.15, 1.15);
      return;
    }
    const { cols, rows } = gridOf(state.world);
    const dx = event.clientX - stick.x;
    const dy = event.clientY - stick.y;
    const yaw = this.camYaw;
    const camOffX = Math.sin(yaw);
    const camOffZ = Math.cos(yaw);
    const fwdX = -camOffX;
    const fwdZ = -camOffZ;
    const rightX = camOffZ;
    const rightZ = -camOffX;
    const wx = (dx * rightX - dy * fwdX) * STEER;
    const wz = (dx * rightZ - dy * fwdZ) * STEER;
    const nextX = clamp(stick.cx + wx, -TILE / 2 + 0.3, cols * TILE - TILE / 2 - 0.3);
    const nextZ = clamp(stick.cz + wz, -TILE / 2 + 0.3, rows * TILE - TILE / 2 - 0.3);
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
    if (key === ' ' || key === 'spacebar') this.audio.unlock();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    this.keys.delete(key);
  };

  private aim(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /** The bottle pours on its own while a run is live. Steering does not start or stop it. */
  private wantsRain(): boolean {
    const state = this.state;
    return !!state && state.phase === 'play' && state.screen === 'play' && !this.introActive;
  }

  private setCamZoom(next: number): void {
    this.camZoom = clamp(next, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
  }

  private stepCameraInput(dt: number): void {
    const state = this.state;
    if (!state || this.globe) return;
    if (state.phase !== 'play' && state.phase !== 'finale') return;
    let orbit = 0;
    if (this.keys.has('q')) orbit -= 1;
    if (this.keys.has('e')) orbit += 1;
    if (orbit !== 0) this.camYaw += orbit * dt * 1.15;
  }

  private skyAxes(): { backX: number; backZ: number; rightX: number; rightZ: number } {
    const yaw = this.camYaw;
    const camOffX = Math.sin(yaw);
    const camOffZ = Math.cos(yaw);
    return {
      backX: camOffX,
      backZ: camOffZ,
      rightX: camOffZ,
      rightZ: -camOffX,
    };
  }

  private placeCamera(dt: number): void {
    if (this.camZoomPulse > 0 && dt > 0 && this.state?.phase !== 'finale') {
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
      const span = CAM_FRAME_SPAN;
      const pull = this.cameraGrowPull(dt);
      const finale = this.state?.phase === 'finale' ? smoothstep(this.state.finaleProgress) : 0;
      const zoomOut = 1 + finale * 1.85;
      const spin = finale * 0.48;
      const yaw = finale > 0 ? this.finaleCamYaw0 + spin : this.camYaw;
      const zoom = finale > 0 ? this.finaleCamZoom0 * zoomOut : this.camZoom;
      const lift = span * 0.42 * zoom * pull;
      const back = span * 0.92 * zoom * pull;
      const camOffX = Math.sin(yaw);
      const camOffZ = Math.cos(yaw);
      const targetX = finale > 0 ? this.finaleFocalX + (this.camX - this.finaleFocalX) * (1 - finale * 0.35) : this.camX;
      const targetZ = finale > 0 ? this.finaleFocalZ + (this.camZ - this.finaleFocalZ) * (1 - finale * 0.35) : this.camZ;
      // The rig rides the ground it is over, so a hill lifts the shot instead of
      // swallowing the cloud behind the crest. The aim rises with the cloud so a
      // big cloud keeps the same spot in frame instead of drifting off the top.
      const grown = this.state?.scale() ?? BASE_SCALE;
      const targetY = gy + CAM_LOOK + CLOUD_LIFT * (grown - BASE_SCALE);
      this.camera.position.set(
        targetX + camOffX * back + jx,
        targetY + lift + jy,
        targetZ + camOffZ * back,
      );
      this.camera.lookAt(targetX, targetY, targetZ);
      return;
    }
    const yaw = this.camYaw;
    this.camera.position.set(
      this.camX + Math.sin(yaw) * Math.cos(PITCH) * dist + jx,
      gy + Math.sin(PITCH) * dist * 0.72 + jy,
      this.camZ + Math.cos(yaw) * Math.cos(PITCH) * dist,
    );
    this.camera.lookAt(this.camX + jx * 0.2, gy + 0.35, this.camZ);
  }

  /**
   * Tell the tilt-shift pass where the cloud sits on screen. The far-distance
   * blur opens up around it, so a big cloud near the top of the frame never
   * smears into a fuzzy smear.
   */
  private updateTiltCloudMask(): void {
    const cloud = this.cloud.position;
    this.cloudProbe.set(cloud.x, cloud.y, cloud.z).project(this.camera);
    const uv = this.tilt.uniforms['uCloud']!.value as THREE.Vector2;
    const size = this.tilt.uniforms['uCloudSize']!.value as THREE.Vector2;
    uv.set(this.cloudProbe.x * 0.5 + 0.5, this.cloudProbe.y * 0.5 + 0.5);
    // Half the sprite on screen, in UV, at the cloud's distance.
    const dist = Math.max(1, this.camera.position.distanceTo(cloud));
    const visible = 2 * dist * Math.tan((this.camera.fov * 0.5 * Math.PI) / 180);
    size.set(
      (2.3 * Math.abs(this.cloud.scale.x)) / Math.max(0.001, visible * this.camera.aspect),
      (1.5 * Math.abs(this.cloud.scale.y)) / Math.max(0.001, visible),
    );
  }

  /**
   * Park the rain ring on a flat plane at the height of the tallest block under
   * the cloud. One level, one clean circle, and nothing slices it.
   */
  private updateRainRing(raining: boolean, reach: number): void {    const mat = this.rainRing.material as THREE.ShaderMaterial;
    const half = Math.max(0.25, reach * 1.14);
    mat.uniforms['uHalf']!.value = half;
    mat.uniforms['uReach']!.value = reach;
    mat.uniforms['uOn']!.value = raining ? 1 : 0;
    this.rainRing.visible = raining;
    this.rainRing.scale.set(half * 2, half * 2, 1);
    if (this.globe) {
      const at = this.lonLatPoint(this.cloudX, this.cloudZ, 6.9);
      this.rainRing.position.set(at.x, at.y, at.z);
      this.rainRing.quaternion.setFromUnitVectors(
        RING_FACE,
        new THREE.Vector3(at.x, at.y, at.z).normalize(),
      );
      return;
    }
    const top = this.terrain
      ? this.terrain.maxHeightNear(this.cloudX, this.cloudZ, reach)
      : this.groundY(this.cloudX, this.cloudZ);
    this.rainRing.position.set(this.cloudX, top + 0.08, this.cloudZ);
    this.rainRing.quaternion.setFromAxisAngle(RING_AXIS, -Math.PI / 2);
  }

  /**
   * The thirst auras: a soft pool of light on the ground over every pocket
   * that still needs water, and a beam once the island is nearly done. An arrow
   * at the screen edge points at the nearest one when it is out of frame.
   */
  private updateAuras(t: number, dt: number): void {
    const state = this.state;
    if (!state) return;
    if (state.phase === 'finale') {
      for (const marker of this.auras) {
        marker.ring.visible = false;
        marker.wisp.visible = false;
      }
      this.aimArrow.visible = false;
      this.auraActive = false;
      return;
    }
    this.auraTick += dt;
    const survey = state.drySurvey(AURA_COUNT * 4);
    this.auraCells = survey.cells;
    // The hint comes on once the island is mostly green. Before that the
    // whole island is thirsty and there is nothing to point at; after it the
    // pockets that are left are small and easy to walk past, which is exactly
    // when the player needs telling where to go.
    const reclaimed = state.ratio();
    const show = reclaimed > 0.42 && reclaimed < 0.86;
    const nearly = show && reclaimed > 0.72 && reclaimed < 0.84;
    // The nearest pocket first: the arrow and the auras should point at the
    // thirsty ground that is closest to the cloud.
    const cloudX = this.cloud.position.x;
    const cloudZ = this.cloud.position.z;
    this.auraTargets = survey.targets
      .slice()
      .sort(
        (a, b) =>
          (a.x - cloudX) ** 2 + (a.z - cloudZ) ** 2 - ((b.x - cloudX) ** 2 + (b.z - cloudZ) ** 2),
      )
      .slice(0, AURA_COUNT);
    this.auraActive = show;
    const pulse = 0.5 + 0.5 * Math.sin(t * (nearly ? 3.4 : 1.5));
    for (let i = 0; i < this.auras.length; i += 1) {
      const marker = this.auras[i];
      const target = show ? this.auraTargets[i] : undefined;
      if (!marker || !target) {
        if (marker) {
          marker.ring.visible = false;
          marker.wisp.visible = false;
        }
        continue;
      }
      const spot = this.auraSpot(target.x, target.z);
      const size = Math.min(2.6, 1.1 + Math.sqrt(target.cells) * 0.1);
      marker.ring.visible = true;
      marker.ring.position.set(spot.x, spot.y, spot.z);
      // The ring lies flat on the ground, or on the curve of the globe.
      marker.ring.quaternion.setFromUnitVectors(
        AURA_NORMAL,
        spot.normal.set(spot.x, spot.y, spot.z).normalize(),
      );
      marker.ring.scale.set(size * (1 + pulse * 0.06), size * (1 + pulse * 0.06), 1);
      const ringMat = marker.ring.material as THREE.MeshBasicMaterial;
      ringMat.opacity = (nearly ? 0.62 : 0.5) * (0.7 + pulse * 0.25);
      const beamH = 1.8 + Math.min(1.2, target.cells * 0.035);
      marker.wisp.visible = i < 1 && !this.globe && nearly;
      if (marker.wisp.visible) {
        marker.wisp.position.set(spot.x, spot.y + beamH * 0.5, spot.z);
        marker.wisp.scale.set(0.42, beamH, 1);
        const wispMat = marker.wisp.material as THREE.MeshBasicMaterial;
        wispMat.opacity = 0.22 * (0.65 + pulse * 0.35);
      }
    }
    this.updateAimArrow();
  }

  /** Where a patch of thirsty ground sits in the world, flat or on the globe. */
  private auraSpot(x: number, z: number): { x: number; y: number; z: number; normal: THREE.Vector3 } {
    if (this.globe) {
      const point = this.lonLatPoint(x, z, 6.9);
      return { ...point, normal: new THREE.Vector3(point.x, point.y, point.z).normalize() };
    }
    return {
      x,
      y: this.groundY(x, z) + 0.06,
      z,
      normal: new THREE.Vector3(0, 1, 0),
    };
  }

  /** Point the edge arrow at the nearest thirsty patch when it is off screen. */
  private updateAimArrow(): void {
    const arrow = this.aimArrow;
    const target = this.auraTargets[0];
    if (!target || this.auraCells <= 0 || !this.auraActive) {
      arrow.visible = false;
      return;
    }
    const spot = this.auraSpot(target.x, target.z);
    const world = new THREE.Vector3(spot.x, spot.y + 1.1, spot.z);
    const view = world.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const behind = view.z > -this.camera.near;
    const ndc = world.clone().project(this.camera);
    let nx = ndc.x;
    let ny = ndc.y;
    // A target behind the camera mirrors to the opposite edge of the screen.
    if (behind) {
      nx = -nx;
      ny = -ny;
    }
    const onScreen = !behind && Math.abs(nx) < 0.88 && Math.abs(ny) < 0.84;
    if (onScreen) {
      arrow.visible = false;
      return;
    }
    arrow.visible = true;
    const dir = new THREE.Vector2(nx, ny);
    if (dir.lengthSq() < 1e-6) dir.set(0, 1);
    dir.normalize().multiplyScalar(0.86);
    const edge = new THREE.Vector3(dir.x, dir.y, 0.5).unproject(this.camera);
    const forward = edge.sub(this.camera.position).normalize();
    arrow.position.copy(this.camera.position).addScaledVector(forward, 13);
    arrow.quaternion.copy(this.camera.quaternion);
    arrow.rotateZ(Math.atan2(dir.y, dir.x) - Math.PI / 2);
  }

  /**
   * A soft contact shadow under every prop. One instanced mesh for the whole
   * island, so the objects stop looking like they float.
   */
  private buildPropShadows(capacity: number): void {
    if (this.propShadows) {
      this.track.remove(this.propShadows);
      this.propShadows.dispose();
      this.propShadows = null;
    }
    if (this.globe || capacity <= 0) return;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: this.glowTexture('shadow'),
      blending: THREE.MultiplyBlending,
      transparent: true,
      depthWrite: false,
      opacity: 1,
      fog: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, capacity);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.count = 0;
    this.propShadows = mesh;
    this.track.add(mesh);
  }

  /**
   * A lake that finally fills spills over the island's edge. The water runs
   * downhill to the rim and falls into the sky, so restoring a pond is a thing
   * you can see from across the island.
   */
  private spawnWaterfall(view: TileView, pondIndex: number): void {
    const state = this.state;
    if (!state || !this.terrain || this.globe) return;
    const centreX = this.terrain.originX + this.terrain.width * 0.5;
    const centreZ = this.terrain.originZ + this.terrain.depth * 0.5;
    let dirX = view.x - centreX;
    let dirZ = view.z - centreZ;
    if (Math.hypot(dirX, dirZ) < 0.5) {
      dirX = 0;
      dirZ = 1;
    }
    const path = this.terrain.downhillPath(view.x, view.z, dirX, dirZ);
    if (path.length < 2) return;
    const lip = path[path.length - 1]!;

    // The stream: a ribbon of water lying on the ground, scrolling downhill.
    const positions: number[] = [];
    const uvs: number[] = [];
    const index: number[] = [];
    let travelled = 0;
    for (let i = 0; i < path.length; i += 1) {
      const p = path[i]!;
      const next = path[Math.min(path.length - 1, i + 1)]!;
      const prev = path[Math.max(0, i - 1)]!;
      let dx = next.x - prev.x;
      let dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const px = -dz;
      const pz = dx;
      const halfWidth = 0.42;
      const y = p.y + 0.07;
      positions.push(p.x + px * halfWidth, y, p.z + pz * halfWidth);
      positions.push(p.x - px * halfWidth, y, p.z - pz * halfWidth);
      if (i > 0) travelled += Math.hypot(p.x - prev.x, p.z - prev.z);
      uvs.push(0, travelled, 1, travelled);
      if (i < path.length - 1) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(index);
    const streamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: this.timeU,
        uColor: { value: new THREE.Color('#bfe9ff') },
        uOpacity: { value: 0.55 },
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
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float flow = fract(vUv.y * 0.9 - uTime * 0.55);
          float streak = smoothstep(0.0, 0.35, flow) * smoothstep(1.0, 0.5, flow);
          float edge = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
          float a = (0.35 + streak * 0.65) * edge * uOpacity;
          if (a <= 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    const stream = new THREE.Mesh(geo, streamMat);
    stream.renderOrder = 4;
    this.track.add(stream);

    // The fall: a curtain of water over the lip, fading out as it drops.
    const fallH = 15;
    const fall = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, fallH),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: this.timeU,
          uColor: { value: new THREE.Color('#dff4ff') },
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
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            // Water accelerates as it falls.
            float t = vUv.y * vUv.y;
            float flow = fract(vUv.y * 1.6 - uTime * (0.7 + vUv.y * 1.6));
            float streak = smoothstep(0.0, 0.4, flow) * smoothstep(1.0, 0.45, flow);
            float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
            float fade = smoothstep(0.0, 0.22, 1.0 - vUv.y) * 0.4 + 0.6;
            float a = (0.3 + streak * 0.8) * edge * fade;
            if (a <= 0.01) discard;
            gl_FragColor = vec4(uColor, a);
          }
        `,
      }),
    );
    fall.userData['bb'] = 1;
    fall.renderOrder = 4;
    fall.position.set(lip.x, lip.y - fallH * 0.5 + 0.1, lip.z);
    this.track.add(fall);

    // Mist where the water disappears into the sky.
    const mist = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 2.2),
      new THREE.MeshBasicMaterial({
        map: this.glowTexture('mist'),
        color: '#dff4ff',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    mist.userData['bb'] = 1;
    mist.renderOrder = 5;
    mist.position.set(lip.x, lip.y - fallH + 0.4, lip.z);
    this.track.add(mist);

    this.waterfalls.push({ fall, mist, stream });
    void pondIndex;
    this.audio.splash();
  }

  /**
   * Rewards the state queued up: achievements, rare blooms and revival
   * milestones. Each one gets a sound and a little light in the world.
   */
  private drainFanfare(): void {
    const state = this.state;
    if (!state) return;
    if (state.pendingMilestone > 0) {
      const pct = state.pendingMilestone;
      state.pendingMilestone = 0;
      this.audio.milestone(pct >= 100 ? 4 : Math.round((pct / 100) * 4));
      this.skyLift = Math.max(this.skyLift, pct >= 100 ? 5.2 : 2.2);
      this.grin = Math.max(this.grin, 0.6);
    }
    if (state.pendingBlooms > 0) {
      const count = state.pendingBlooms;
      state.pendingBlooms = 0;
      this.audio.bloomAward();
      this.cloudPop = Math.max(this.cloudPop, 1.2);
      for (let i = 0; i < count; i += 1) {
        this.burst(this.cloud.position.x, this.cloud.position.y - 0.2, this.cloud.position.z, 6);
      }
    }
    if (state.pendingAchievements.length > 0) {
      const ids = state.pendingAchievements.splice(0, state.pendingAchievements.length);
      this.audio.achievement();
      for (let i = 0; i < ids.length; i += 1) {
        this.burst(this.cloud.position.x, this.cloud.position.y + 0.2, this.cloud.position.z, 10);
      }
      this.grin = Math.max(this.grin, 0.8);
    }
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

  private makePulse(data: Uint8Array, cols: number, rows: number): THREE.DataTexture {
    const tex = new THREE.DataTexture(data as never, cols, rows, THREE.RedFormat);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;
    tex.needsUpdate = true;
    return tex;
  }

  private syncPulse(): void {
    const state = this.state;
    if (!state) return;
    const { cols, rows } = maskOf(state.world);
    if (!this.pulseTex || this.pulseTex.image.width !== cols || this.pulseTex.image.height !== rows) {
      this.pulseTex = this.makePulse(state.pulse, cols, rows);
      for (const mat of this.maskMats) {
        if (mat.uniforms['uPulse']) mat.uniforms['uPulse'].value = this.pulseTex;
      }
    } else {
      (this.pulseTex.image as { data: Uint8Array }).data = state.pulse;
    }
    this.pulseTex.needsUpdate = true;
    state.pulseDirty = false;
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
    const pull = this.cameraGrowPull(dt);
    if (this.globe) return (9 + 6 / pull) * Math.pow(pull, 0.35);
    // Local rig: the fog band follows the close framing, not the whole island.
    return clamp(CAM_FRAME_SPAN * 0.42 * pull, 8, 20);
  }

  /** Point on a virtual sky shell at the given screen NDC position (sun, clouds, distant islands). */
  private skyPoint(ndcX: number, ndcY: number, dist: number): THREE.Vector3 {
    const v = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    return this.camera.position.clone().addScaledVector(dir, dist);
  }

  private dressSky(t: number): void {
    const state = this.state;
    const { backX, backZ } = this.skyAxes();
    // The sun belongs to the island, not to the camera: turning the view must
    // not swing the light around.
    const sun = this.sunDir;
    const worldSun = worldDef(this.state?.world ?? 0).sun;
    sun.set(worldSun[0], worldSun[1], worldSun[2]).normalize();
    this.rainUniform.value = this.rainMix;
    this.sunColor.copy(this.sunClear).lerp(this.sunOvercast, this.rainMix);
    this.sunColor.multiplyScalar(1 - this.rainMix * 0.28);
    const grown = this.state?.scale() ?? 1;
    this.cloudShadow.set(this.cloud.position.x, this.cloud.position.z, 1.7 + grown * 1.15);
    const camUp = this.skyMat.uniforms['uCamUp']!.value as THREE.Vector3;
    camUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    let anchorX = this.camX;
    let anchorZ = this.camZ;
    const ratio = state?.ratio() ?? 0;
    this.skyMat.uniforms['uTime']!.value = t;
    this.skyMat.uniforms['uLife']!.value = ratio;
    const moteMat = this.skyMotes.material as THREE.ShaderMaterial;
    moteMat.uniforms['uTime']!.value = t;
    this.skyMotes.visible = !this.globe;
    if (this.terrain && state && !this.globe) {
      anchorX = this.terrain.originX + this.terrain.width * 0.5;
      anchorZ = this.terrain.originZ + this.terrain.depth * 0.5;
      this.skyDome.position.set(anchorX, 6, anchorZ);
      this.skyMotes.position.set(anchorX, 0, anchorZ);
      this.skyMotes.rotation.y = t * 0.035;

      // Layered backdrop ranges pinned just above the island's far edge.
      // Tail extends well below the island's crest so the range has no visible cut edge.
      this.hillsBackdrop.position.copy(this.skyPoint(-0.05, 0.33 + Math.sin(t * 0.24) * 0.006, 40));
      this.sizeTo(this.hillsBackdrop, 82, 7.2);
      this.hillsFar.position.copy(this.skyPoint(0.06, 0.54 + Math.sin(t * 0.17 + 1.4) * 0.008, 60));
      this.sizeTo(this.hillsFar, 94, 8);

      // The disc keeps a home in the sky while the light stays with the island.
      const sunDist = 118;
      const sun = this.skyPoint(0.3, 0.86, sunDist);
      this.sunDisc.position.copy(sun);
      this.sunHalo.position.copy(sun);
      const sunPulse = 1 + Math.sin(t * 1.1) * 0.05;
      this.sunDisc.scale.setScalar(4.6 * sunPulse);
      this.sunHalo.scale.setScalar(9 + Math.sin(t * 0.8 + 2) * 0.35);
      const sunMat = this.sunDisc.material as THREE.MeshBasicMaterial;
      sunMat.opacity = 0.95 - this.rainMix * 0.5;
      const haloMat = this.sunHalo.material as THREE.MeshBasicMaterial;
      haloMat.opacity = (0.34 + Math.sin(t * 0.9) * 0.04) * (1 - this.rainMix * 0.65);
      this.sunDisc.lookAt(this.camera.position);

      const spotTick = Math.floor(t / 0.4);
      if (spotTick !== this.sunSpotTick) {
        this.sunSpotTick = spotTick;
        this.sunSpots = state.sunPatches(3);
      }
      const anchors = this.sunSpots;
      const per = anchors.length <= 1 ? 3 : anchors.length === 2 ? 2 : 1;
      this.shafts.forEach((shaft, i) => {
        const spot = anchors[Math.floor(i / per)];
        if (!spot) {
          shaft.visible = false;
          return;
        }
        const phase = Number(shaft.userData['shaftPhase']) || 0;
        const side = (i % per) - (per - 1) / 2;
        const x = spot.x + side * 0.55 + Math.sin(t * 0.18 + phase) * 0.05;
        const z = spot.z + Math.cos(t * 0.15 + phase) * 0.08;
        const gy = this.groundY(x, z);
        const h = 8.2 + (i % 3) * 1.6 + spot.w * 1.4;
        shaft.position.set(x, gy + h * 0.46, z);
        this.sizeTo(shaft, 1.05 + spot.w * 0.85, h);
        shaft.userData['tiltZ'] = -0.18 + side * 0.07;
        const mat = shaft.material as THREE.MeshBasicMaterial;
        const weather = 0.62 + (1 - this.rainMix) * 0.38;
        mat.opacity = (0.14 + spot.w * 0.22) * (0.86 + Math.sin(t * 0.65 + phase) * 0.14) * weather;
        shaft.visible = true;
      });
      // The thirst auras take over from here: they point at the pockets that
      // still need water, and they look nothing like the warm praise shafts.

      const bowStrength = clamp((ratio - 0.55) / 0.35, 0, 1);
      const finale = state.phase === 'finale' ? clamp(state.finaleProgress * 2.2, 0, 1) : 0;
      const bowMat = this.rainbow.material as THREE.MeshBasicMaterial;
      bowMat.opacity = Math.max(bowStrength * 0.6, finale * 0.9);
      this.rainbow.visible = bowMat.opacity > 0.01;
      this.rainbow.position.copy(this.skyPoint(0.3, 0.6, 100));
      this.sizeTo(this.rainbow, 46, 23);

      const mistMat = this.mist.material as THREE.MeshBasicMaterial;
      mistMat.opacity = this.rainMix * 0.2;
      this.mist.visible = mistMat.opacity > 0.01;
      this.mist.position.set(this.camX - backX * 5, 1.15, this.camZ - backZ * 5);
      this.sizeTo(this.mist, CAM_FRAME_SPAN * 1.1, CAM_FRAME_SPAN * 0.2);
    } else {
      this.hillsFar.visible = false;
      this.sunHalo.visible = false;
      this.rainbow.visible = false;
      this.mist.visible = false;
      this.shafts.forEach((shaft) => (shaft.visible = false));
    }
    this.softClouds.forEach((cloud, i) => {
      if (this.globe) {
        cloud.mesh.visible = false;
        return;
      }
      const track = 3.0;
      const driftX = ((((i / 5) * track + t * cloud.speed * 0.004) % track) + track) % track - track * 0.5;
      const p = this.skyPoint(driftX, 0.62 + cloud.lift * 0.7 + Math.sin(t * 0.22 + cloud.phase) * 0.012, 86 + cloud.depth * 8);
      cloud.mesh.position.copy(p);
      this.sizeTo(cloud.mesh, 10 + cloud.depth * 1.8, 3.4 + cloud.depth * 0.5);
      const cMat = cloud.mesh.material as THREE.ShaderMaterial;
      litOpacity(cMat).value = (0.44 - (i % 3) * 0.08) * (1 - this.rainMix * 0.35);
      cloud.mesh.visible = true;
    });
    this.puffs.forEach((mesh, i) => {
      const drift = this.puffDrift[i] ?? 0;
      const track = 2.6;
      const ndcX = ((((drift * 0.28 + t * 0.006) % track) + track) % track) - track * 0.5;
      const p = this.skyPoint(ndcX, 0.6 + (i % 3) * 0.08 + Math.sin(t * 0.3 + drift) * 0.01, 46);
      mesh.position.copy(p);
      const size = 3.4 + (i % 3) * 0.9;
      this.sizeTo(mesh, size * 1.25, size * 0.5);
    });
    for (const bird of this.birds) {
      const ang = t * bird.speed + bird.phase;
      const flap = Math.sin(t * 9 + bird.phase) > 0 ? 1 : 0.82;
      const bx = Math.sin(ang * 0.5 + bird.phase) * 0.85;
      const p = this.skyPoint(bx, 0.5 + Math.sin(t * 0.5 + bird.phase) * 0.06, 30);
      bird.mesh.position.copy(p);
      this.sizeTo(bird.mesh, 0.62 * flap, 0.36);
      const visible = (state?.ratio() ?? 0) > 0.04 || (state?.world ?? 0) > 0;
      bird.mesh.visible = visible && !this.globe;
    }

    this.stepWinds(t, this.camX, this.camZ, CAM_FRAME_SPAN);
    for (let i = 0; i < this.parallaxIslands.length; i += 1) {
      const isl = this.parallaxIslands[i]!;
      if (this.globe) {
        isl.mesh.visible = false;
        continue;
      }
      const spread = clamp(isl.spread * 0.01, -0.85, 0.85);
      const bob = Math.sin(t * 0.38 + isl.bobPhase) * 0.01;
      const p = this.skyPoint(spread, 0.72 + (i % 3) * 0.05 + bob, 120);
      isl.mesh.position.copy(p);
      const s = 2.4 + isl.size * 1.1;
      this.sizeTo(isl.mesh, s * 1.4, s);
      isl.mesh.visible = i < 4;
    }
  }

  /** Wind streaks that sweep across the board, synced to the grass gust waves. */
  private stepWinds(t: number, anchorX: number, anchorZ: number, span: number): void {
    const state = this.state;
    if (this.globe || !state) {
      for (const trail of this.winds) trail.mesh.visible = false;
      return;
    }
    const alive = state.phase === 'play' || state.phase === 'finale';
    const ratio = state.ratio();
    for (const trail of this.winds) {
      const mesh = trail.mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const travel = span * 1.45;
      const x = ((((t * trail.speed * trail.dir + trail.phase * span * 1.9) % (travel * 2)) + travel * 2) % (travel * 2)) - travel;
      const zOff = Math.sin(t * 0.6 + trail.phase) * span * 0.18;
      mesh.position.set(anchorX + x, trail.y + Math.sin(t * 0.8 + trail.phase) * 0.15, anchorZ + zOff);
      const gust = this.gustAt(anchorX + x * 0.6, anchorZ, t);
      mat.opacity = alive && ratio > 0.12 ? (0.05 + gust * 0.24) * 0.9 : 0;
      trail.mesh.visible = mat.opacity > 0.01;
      this.sizeTo(trail.mesh, span * 0.055, span * 0.011);
      trail.mesh.userData['tiltZ'] = trail.dir > 0 ? 0.06 : Math.PI - 0.06;
    }
  }

  private faceAll(): void {
    this.scene.traverse((obj) => {
      if (!obj.userData['bb']) return;
      if (obj.userData['upright']) {
        const dx = this.camera.position.x - obj.position.x;
        const dz = this.camera.position.z - obj.position.z;
        obj.rotation.set(0, Math.atan2(dx, dz) + Math.PI, 0);
        return;
      }
      const roll = obj === this.cloud ? Number(obj.userData['roll']) || 0 : 0;
      obj.lookAt(this.camera.position);
      obj.rotateY(Math.PI);
      if (roll) obj.rotateZ(roll);
      const tilt = Number(obj.userData['tiltZ']) || 0;
      if (tilt) obj.rotateZ(tilt);
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
    // keep the cloud clearly airborne so the pour reads as a column of rain
    this.hoverY = gy + 1.8 + 2.5 * (this.state?.scale() ?? 0.48);
    this.cloud.position.set(at.x, this.hoverY, at.z);
    this.placeCamera(0);
  }

  private restoredSpots(): number[] {
    const state = this.state;
    if (!state) return [0];
    const strong: number[] = [];
    const soft: number[] = [];
    const tiles = state.current();
    for (let i = 0; i < tiles.length; i += 1) {
      const view = this.views[i];
      // skip shore tiles whose ground has eroded away: critters would float there
      if (view && this.groundY(view.x, view.z) < 0.35) continue;
      if (state.isRestored(i)) strong.push(i);
      else if (state.hillWet(i) > 0.55) soft.push(i);
    }
    if (strong.length >= 3) return strong;
    // early game: let critters roam the greening land around the few finished tiles
    const all = [...strong, ...soft];
    if (all.length > 0) return all;
    const { cols, rows } = gridOf(state.world);
    return [Math.floor(rows / 2) * cols + Math.floor(cols / 2)];
  }

  private spawnBaby(): void {
    const mesh = this.billboard(this.art.baby, 0.8, 0.52, 0.15);
    const x = this.cloudX + (Math.random() > 0.5 ? -6 : 6);
    const z = this.cloudZ + (Math.random() - 0.5) * 6;
    mesh.position.set(x, 2.5, z);
    this.scene.add(mesh);
    this.babies.push({ mesh, x, z });
  }

  private spawnTornado(lifeStorm = false): void {
    if (this.tornado) this.scene.remove(this.tornado.mesh);
    const len = Math.hypot(this.faceX, this.faceZ) || 1;
    this.faceX /= len;
    this.faceZ /= len;
    const mesh = this.billboard(this.art.tornado, 1.15, 1.35, 0.15);
    if (lifeStorm) (mesh.material as THREE.MeshBasicMaterial).color.set('#9ef0b4');
    mesh.position.set(this.cloudX, 1.05, this.cloudZ);
    this.scene.add(mesh);
    this.tornado = { mesh, x: this.cloudX, z: this.cloudZ, life: lifeStorm ? 4.2 : 3.4, acc: 0 };
    if (lifeStorm) {
      this.abilityVfx.play(
        'lifestorm',
        this.cloudX,
        this.groundY(this.cloudX, this.cloudZ),
        this.cloudZ,
        this.state?.reach() ?? 1,
      );
    }
  }

  private flashBolt(center: number): void {
    const at = this.views[center] ?? this.tilePos(center);
    const x = 'x' in at ? at.x : 0;
    const z = 'z' in at ? at.z : 0;
    const mesh = new THREE.Mesh(boltGeometry(6.4, 0.13), boltMaterial());
    mesh.position.set(x, 3.2, z);
    mesh.userData['bb'] = 1;
    this.scene.add(mesh);
    this.bolts.push({ mesh, life: 0.24 });
    // The strike lands with a flash on the ground.
    this.rippleAt(x, z, '#dff4ff');
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
    drop.vx = (Math.random() - 0.5) * 0.8;
    drop.vz = (Math.random() - 0.5) * 0.8;
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
      this.drops.push({ mesh, y: 0, vy: 0, vx: 0, vz: 0, alive: false });
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

  /** Prop ladder step for a decor at the given tile wetness: 0 litter, 1 sprouting, 2 grown. */
  private propStep(decor: Decor, wet: number): number {
    if (decor === 'tree') return wet >= 0.66 ? 2 : wet >= 0.44 ? 1 : 0;
    if (decor === 'bush') return wet >= 0.58 ? 2 : wet >= 0.32 ? 1 : 0;
    if (decor === 'rock') return wet >= 0.5 ? 1 : 0;
    return wet >= 0.56 ? 1 : 0;
  }

  private propBase(decor: Decor, step: number, index: number): number {
    if (decor === 'tree') {
      if (step === 2) return 1.25 + ((index * 7) % 5) * 0.08;
      return step === 1 ? 0.62 + ((index * 3) % 4) * 0.04 : 0.95;
    }
    if (decor === 'bush') return step === 2 ? 1.06 + ((index * 3) % 4) * 0.06 : step === 1 ? 0.74 : 1;
    return 1;
  }

  private propMesh(decor: Decor, world: number, index: number): THREE.Mesh | null {
    void world;
    void index;
    const upright = (mesh: THREE.Mesh) => {
      mesh.userData['upright'] = 1;
      return this.anchorAtBase(mesh);
    };
    if (decor === 'tree') return upright(this.litBillboard(this.art.sapling, 2.6, 3.6, 0.12));
    if (decor === 'bush') return upright(this.litBillboard(this.art.bushDead, 0.72, 0.55, 0.2));
    if (decor === 'rock') return upright(this.litBillboard(this.art.rock, 0.62, 0.42, 0.2));
    return upright(this.litBillboard(this.art.twig, 0.55, 0.4, 0.18));
  }

  /**
   * Move a sprite's pivot from its middle down to its feet, so a wind sway
   * leans the tree from the ground up instead of swinging the trunk.
   */
  private anchorAtBase(mesh: THREE.Mesh): THREE.Mesh {
    const h = Number(mesh.userData['ph']) || 1;
    mesh.geometry.translate(0, h / 2, 0);
    return mesh;
  }

  private propTexture(decor: Decor, step: number, world: number, index: number): THREE.Texture {
    const art = this.art;
    if (decor === 'tree') {
      // Every island grows its own grove.
      const grove = art.groveByWorld[world] ?? art.grove;
      if (step === 2) return grove[(index + world * 3) % grove.length] ?? art.liveTree[0]!;
      if (step === 1) return art.sapling;
      return art.deadTree[world] ?? art.deadTree[0]!;
    }
    if (decor === 'bush') {
      if (step === 2) return art.bushByWorld[world] ?? art.bushLive;
      return step === 1 ? art.bushSprout : art.bushDead;
    }
    if (decor === 'rock') {
      if (world === 3 && step === 0) return art.barrel;
      return step === 1 ? art.rockMoss : art.rock;
    }
    return step === 1 ? art.flowers : art.twig;
  }

  private glowTexture(
    kind: 'shaft' | 'soft' | 'mist' | 'halo' | 'aura' | 'wisp' | 'shadow',
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width =
      kind === 'mist' ? 256 : kind === 'halo' ? 128 : kind === 'aura' ? 96 : 64;
    canvas.height =
      kind === 'mist' ? 64 : kind === 'halo' ? 128 : kind === 'aura' ? 96 : kind === 'shadow' ? 64 : 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (kind === 'halo') {
        const rg = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
        rg.addColorStop(0, 'rgba(255,255,255,0.6)');
        rg.addColorStop(0.42, 'rgba(255,255,255,0.2)');
        rg.addColorStop(0.72, 'rgba(255,255,255,0.05)');
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, 128, 128);
      } else if (kind === 'aura') {
        // A cold ring of light on the ground: a bright edge with a soft pool
        // inside, so it reads on grass as well as on stone.
        const rg = ctx.createRadialGradient(48, 48, 2, 48, 48, 48);
        rg.addColorStop(0, 'rgba(150, 220, 255, 0.14)');
        rg.addColorStop(0.5, 'rgba(170, 230, 255, 0.2)');
        rg.addColorStop(0.76, 'rgba(214, 246, 255, 0.95)');
        rg.addColorStop(0.88, 'rgba(180, 235, 255, 0.45)');
        rg.addColorStop(1, 'rgba(150, 220, 255, 0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, 96, 96);
      } else if (kind === 'wisp') {
        // A column of light: bright at the ground, thinning as it rises.
        for (let y = 0; y < 256; y += 1) {
          const t = y / 255;
          const band = Math.pow(t, 0.8);
          ctx.fillStyle = `rgba(216, 242, 255, ${(0.95 * band).toFixed(3)})`;
          ctx.fillRect(0, y, 64, 1);
        }
        ctx.globalCompositeOperation = 'destination-in';
        const sideMask = ctx.createLinearGradient(0, 0, 64, 0);
        sideMask.addColorStop(0, 'rgba(0,0,0,0)');
        sideMask.addColorStop(0.5, 'rgba(0,0,0,1)');
        sideMask.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sideMask;
        ctx.fillRect(0, 0, 64, 256);
        ctx.globalCompositeOperation = 'source-over';
      } else if (kind === 'shadow') {
        // A soft contact shadow: multiply blending, so the ground darkens under
        // an object instead of a black blob being painted on top of it.
        const sg = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
        sg.addColorStop(0, 'rgb(74, 66, 84)');
        sg.addColorStop(0.45, 'rgb(120, 112, 132)');
        sg.addColorStop(0.78, 'rgb(226, 222, 232)');
        sg.addColorStop(1, 'rgb(255,255,255)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, 64, 64);
      } else if (kind === 'mist') {
        for (let y = 0; y < 64; y += 1) {
          const vy = 1 - Math.abs(y / 63 - 0.5) * 2;
          const band = Math.pow(Math.max(0, vy), 1.6);
          const g = ctx.createLinearGradient(0, 0, 256, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.28, `rgba(255,255,255,${(0.42 * band).toFixed(3)})`);
          g.addColorStop(0.62, `rgba(240,250,255,${(0.5 * band).toFixed(3)})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, y, 256, 1);
        }
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, 256);
        if (kind === 'shaft') {
          g.addColorStop(0, 'rgba(255, 248, 220, 0)');
          g.addColorStop(0.32, 'rgba(255, 243, 205, 0.9)');
          g.addColorStop(0.7, 'rgba(255, 232, 182, 0.34)');
          g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 256);
        // Soften the beam's sides so shafts read as light, not rectangles.
        ctx.globalCompositeOperation = 'destination-in';
        const sideMask = ctx.createLinearGradient(0, 0, 64, 0);
        sideMask.addColorStop(0, 'rgba(0,0,0,0)');
        sideMask.addColorStop(0.5, 'rgba(0,0,0,1)');
        sideMask.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sideMask;
        ctx.fillRect(0, 0, 64, 256);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  private litBillboard(
    map: THREE.Texture,
    w: number,
    h: number,
    alphaTest: number,
    noFog = false,
  ): THREE.Mesh {
    const fog = this.scene.fog as THREE.Fog;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      makeLitSprite(map, this.sunDir, this.sunColor, alphaTest, {
        color: fog.color,
        near: noFog ? 1e5 : fog.near,
        far: noFog ? 2e5 : fog.far,
      }),
    );
    mesh.userData['ph'] = h;
    mesh.userData['gw'] = w;
    mesh.userData['s'] = 1;
    mesh.userData['bb'] = 1;
    return mesh;
  }

  private billboard(map: THREE.Texture, w: number, h: number, alphaTest: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest, side: THREE.DoubleSide }),
    );
    mesh.userData['ph'] = h;
    mesh.userData['gw'] = w;
    mesh.userData['s'] = 1;
    mesh.userData['bb'] = 1;
    return mesh;
  }

  /** Sets a billboard's world size (its geometry has its own base size). */
  private sizeTo(mesh: THREE.Mesh, w: number, h: number): void {
    const gw = Number(mesh.userData['gw']) || 1;
    const gh = Number(mesh.userData['ph']) || 1;
    mesh.scale.set(w / gw, h / gh, 1);
  }

  /** Plane sprite meant to live inside a billboarded group (inherits the group's facing). */
  private sprite(map: THREE.Texture, w: number, h: number, alphaTest: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest, side: THREE.DoubleSide }),
    );
    mesh.position.z = z;
    return mesh;
  }

  private pushHud(force: boolean): void {
    const state = this.state;
    if (!state) return;
    let pond: number | null = null;
    const center = this.nearestTile();
    if (state.spec(center).kind === 'pond' && !state.isRestored(center)) {
      pond = state.pondFill(center);
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
    this.bloom.setSize(w, h);
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
