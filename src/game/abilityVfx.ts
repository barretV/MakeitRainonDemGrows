import * as THREE from 'three';
import type { AbilityId } from './abilities';

/**
 * The ability effects.
 *
 * These used to be unlit rings and cylinders, which read as debug primitives
 * next to the hand-painted world. Every effect is now a soft additive shader
 * with its own shape, and the ones that should spin, spin.
 */

const MODE_RING = 0;
const MODE_COLUMN = 1;
const MODE_BAND = 2;
const MODE_BURST = 3;
const MODE_CONE = 4;

const ABILITY_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ABILITY_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uLife;
  uniform int uMode;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float a = 0.0;
    if (uMode == 0) {
      // A ring of light on the ground.
      float d = length(p);
      a = smoothstep(1.0, 0.88, d) * smoothstep(0.5, 0.84, d);
    } else if (uMode == 1) {
      // Falling streaks.
      float streak = fract(vUv.y * 2.2 - uTime * 1.7);
      float body = smoothstep(1.0, 0.08, abs(p.x));
      float s = smoothstep(0.0, 0.32, streak) * smoothstep(1.0, 0.5, streak);
      a = body * (0.3 + 0.7 * s);
    } else if (uMode == 2) {
      // A wide shimmer sweeping sideways.
      float body = smoothstep(1.0, 0.15, abs(p.y));
      float wave = 0.55 + 0.45 * sin(vUv.x * 9.0 - uTime * 2.4);
      a = body * wave;
    } else if (uMode == 3) {
      // A soft pop.
      float d = length(p);
      a = smoothstep(1.0, 0.05, d) * 0.75;
    } else {
      // A twisting cone of water.
      float r = mix(0.12, 0.85, vUv.y);
      float d = abs(length(p) - r * 0.55);
      float twist = 0.5 + 0.5 * sin(vUv.y * 9.0 - uTime * 5.0);
      a = smoothstep(0.45, 0.0, d) * (0.45 + 0.55 * twist);
    }
    a *= uLife;
    if (a <= 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

interface Fx {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  spin: number;
  grow: number;
  baseW: number;
  baseH: number;
}

export class AbilityVfx {
  private readonly fx: Fx[] = [];

  constructor(private readonly root: THREE.Group) {}

  play(id: AbilityId, x: number, y: number, z: number, reach: number): void {
    switch (id) {
      case 'geyser':
        this.column(x, y, z, '#9fdcff', reach * 0.8, 3.4, 0.9);
        this.ring(x, y, z, '#cdefff', reach * 0.75, 0.8);
        break;
      case 'spore':
        this.ring(x, y, z, '#8ff09a', reach * 1.15, 0.55);
        this.ring(x, y, z, '#d6ffc4', reach * 0.7, 0.4);
        break;
      case 'rainbow':
        this.arc(x, y, z, reach * 1.3);
        break;
      case 'hail':
        this.burst(x, y, z, '#eaf9ff', reach * 0.85, 0.45);
        this.ring(x, y, z, '#dff4ff', reach * 0.7, 0.5);
        break;
      case 'mirage':
        this.band(x, y, z, '#ffd98a', reach * 1.3, 0.7);
        break;
      case 'waterbomb':
        this.burst(x, y, z, '#8fd4ff', reach * 1.1, 0.65);
        this.ring(x, y, z, '#bfe9ff', reach * 0.9, 0.6);
        break;
      case 'whirlpool':
      case 'sprinkler':
        this.spinner(x, y, z, '#9fe0ff', reach, 0.55);
        this.ring(x, y, z, '#d8f4ff', reach * 0.6, 0.45);
        break;
      case 'purify':
        this.ring(x, y, z, '#c6ffb0', reach, 0.6);
        this.ring(x, y, z, '#eaffd8', reach * 0.65, 0.45);
        break;
      case 'monsoon':
        this.band(x, y, z, '#9fdcff', reach * 2, 0.9);
        break;
      case 'lifestorm':
      case 'tornado':
        this.twister(x, y, z, '#b6ffcf', reach * 1.2, 0.9);
        break;
      case 'lightning':
        this.column(x, y, z, '#dff4ff', reach * 0.6, 2.6, 0.35);
        this.ring(x, y, z, '#eaf9ff', reach * 0.85, 0.45);
        break;
      default:
        this.ring(x, y, z, '#ffffff', reach * 0.7, 0.35);
    }
  }

  update(dt: number): void {
    for (let i = this.fx.length - 1; i >= 0; i -= 1) {
      const item = this.fx[i];
      if (!item) continue;
      item.life -= dt;
      const t = Math.max(0, item.life / item.maxLife);
      const mat = item.mesh.material as THREE.ShaderMaterial;
      if (mat.uniforms?.['uLife']) mat.uniforms['uLife'].value = t;
      if (mat.uniforms?.['uTime']) mat.uniforms['uTime'].value = (mat.uniforms['uTime'].value as number) + dt;
      if (!mat.uniforms && 'opacity' in mat) {
        (mat as unknown as THREE.MeshBasicMaterial).opacity = t * 0.75;
      }
      if (item.spin) item.mesh.rotation.z += item.spin * dt;
      if (item.grow) {
        const grow = 1 + (1 - t) * item.grow;
        item.mesh.scale.set(item.baseW * grow, item.baseH * grow, 1);
      }
      if (item.life <= 0) {
        this.root.remove(item.mesh);
        item.mesh.geometry.dispose();
        mat.dispose();
        this.fx.splice(i, 1);
      }
    }
  }

  private material(mode: number, color: string): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uTime: { value: 0 },
        uLife: { value: 1 },
        uMode: { value: mode },
      },
      vertexShader: ABILITY_VERT,
      fragmentShader: ABILITY_FRAG,
    });
  }

  private push(mesh: THREE.Mesh, life: number, spin = 0, grow = 0): void {
    this.root.add(mesh);
    this.fx.push({
      mesh,
      life,
      maxLife: life,
      spin,
      grow,
      baseW: mesh.scale.x,
      baseH: mesh.scale.y,
    });
  }

  private quad(
    mode: number,
    color: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    life: number,
    flat: boolean,
    spin = 0,
    grow = 0,
  ): void {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material(mode, color));
    mesh.scale.set(w, h, 1);
    if (flat) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y + 0.06, z);
    } else {
      mesh.userData['bb'] = 1;
      mesh.position.set(x, y + h * 0.5, z);
    }
    mesh.renderOrder = 7;
    this.push(mesh, life, spin, grow);
  }

  /** A ring of light lying on the ground. */
  private ring(x: number, y: number, z: number, color: string, r: number, life: number): void {
    this.quad(MODE_RING, color, x, y, z, r * 2, r * 2, life, true, 0, 0.35);
  }

  /** A curtain of water falling from the sky. */
  private column(x: number, y: number, z: number, color: string, r: number, h: number, life: number): void {
    this.quad(MODE_COLUMN, color, x, y, z, r * 2, h, life, false, 0, 0);
  }

  /** A wide shimmer across the ground. */
  private band(x: number, y: number, z: number, color: string, r: number, life: number): void {
    this.quad(MODE_BAND, color, x, y, z, r * 2, r * 0.55, life, true, 0, 0.2);
  }

  /** A soft pop. */
  private burst(x: number, y: number, z: number, color: string, r: number, life: number): void {
    this.quad(MODE_BURST, color, x, y + r * 0.5, z, r * 2, r * 2, life, false, 0, 0.8);
  }

  /** A ring that turns, like water circling a sprinkler. */
  private spinner(x: number, y: number, z: number, color: string, r: number, life: number): void {
    this.quad(MODE_RING, color, x, y, z, r * 2, r * 2, life, true, 3.4, 0.5);
  }

  /** A twisting column of water. */
  private twister(x: number, y: number, z: number, color: string, r: number, life: number): void {
    this.quad(MODE_CONE, color, x, y, z, r * 2.2, 3.2, life, false, 2.6, 0);
  }

  /** The rainbow: a fan of coloured arcs over the island. */
  private arc(x: number, y: number, z: number, span: number): void {
    const colors = ['#ff6b9d', '#ffd56a', '#7ddf6a', '#6ec8ff', '#c9a0ff'];
    for (let i = 0; i < colors.length; i += 1) {
      const geo = new THREE.TorusGeometry(span * 0.35, 0.05, 6, 28, Math.PI * 0.55);
      const mat = new THREE.MeshBasicMaterial({
        color: colors[i] ?? '#ffffff',
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData['bb'] = 1;
      mesh.rotation.set(Math.PI / 2 + i * 0.08, 0, i * 0.4);
      mesh.position.set(x, y + 1.2 + i * 0.05, z);
      mesh.renderOrder = 7;
      this.root.add(mesh);
      this.fx.push({ mesh, life: 0.75, maxLife: 0.75, spin: 0, grow: 0, baseW: 1, baseH: 1 });
    }
  }
}
