import * as THREE from 'three';
import type { AbilityId } from './abilities';

interface Fx {
  mesh: THREE.Object3D;
  life: number;
}

export class AbilityVfx {
  private readonly fx: Fx[] = [];

  constructor(private readonly root: THREE.Group) {}

  play(id: AbilityId, x: number, y: number, z: number, reach: number): void {
    switch (id) {
      case 'geyser':
        this.column(x, y, z, '#6ec8ff', reach * 0.9, 1.4);
        break;
      case 'spore':
        this.ring(x, y, z, '#7ddf6a', reach * 1.1, 0.55);
        break;
      case 'rainbow':
        this.arc(x, y, z, reach * 1.3);
        break;
      case 'hail':
        this.burst(x, y, z, '#d8f4ff', reach * 0.8, 0.45);
        break;
      case 'mirage':
        this.band(x, y, z, '#f5d27a', reach * 1.2, 0.7);
        break;
      case 'waterbomb':
        this.burst(x, y, z, '#4aa8e8', reach * 1.1, 0.65);
        break;
      case 'whirlpool':
      case 'sprinkler':
        this.spiral(x, y, z, '#7ec8f0', reach, 0.5);
        break;
      case 'purify':
        this.ring(x, y, z, '#b8ff9a', reach, 0.6);
        break;
      case 'monsoon':
        this.band(x, y, z, '#6ec8ff', reach * 2, 0.9);
        break;
      case 'lifestorm':
      case 'tornado':
        this.spiral(x, y, z, '#9ef0b4', reach * 1.2, 0.85);
        break;
      case 'lightning':
        this.column(x, y, z, '#b6f0ff', reach * 0.7, 0.35);
        break;
      default:
        this.ring(x, y, z, '#ffffff', reach * 0.6, 0.35);
    }
  }

  update(dt: number): void {
    for (let i = this.fx.length - 1; i >= 0; i -= 1) {
      const item = this.fx[i];
      if (!item) continue;
      item.life -= dt;
      const t = Math.max(0, item.life);
      item.mesh.scale.setScalar(1 + (1 - t) * 0.35);
      const mat = (item.mesh as THREE.Mesh).material;
      if (mat && (mat as THREE.MeshBasicMaterial).opacity !== undefined) {
        (mat as THREE.MeshBasicMaterial).opacity = Math.min(1, t * 2);
      }
      if (item.life <= 0) {
        this.root.remove(item.mesh);
        this.fx.splice(i, 1);
      }
    }
  }

  private push(mesh: THREE.Object3D, life: number): void {
    this.root.add(mesh);
    this.fx.push({ mesh, life });
  }

  private ring(x: number, y: number, z: number, color: string, r: number, life: number): void {
    const geo = new THREE.RingGeometry(r * 0.2, r, 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.08, z);
    this.push(mesh, life);
  }

  private column(x: number, y: number, z: number, color: string, h: number, life: number): void {
    const geo = new THREE.CylinderGeometry(0.12, 0.28, h, 10, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + h * 0.5, z);
    this.push(mesh, life);
  }

  private burst(x: number, y: number, z: number, color: string, r: number, life: number): void {
    const geo = new THREE.SphereGeometry(r * 0.35, 12, 10);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + 0.4, z);
    this.push(mesh, life);
  }

  private spiral(x: number, y: number, z: number, color: string, r: number, life: number): void {
    const geo = new THREE.TorusGeometry(r * 0.45, 0.06, 8, 24);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y + 0.5, z);
    mesh.userData['spin'] = 1;
    this.push(mesh, life);
  }

  private band(x: number, y: number, z: number, color: string, w: number, life: number): void {
    const geo = new THREE.PlaneGeometry(w, 0.35);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.12, z);
    this.push(mesh, life);
  }

  private arc(x: number, y: number, z: number, span: number): void {
    const colors = ['#ff6b9d', '#ffd56a', '#7ddf6a', '#6ec8ff', '#c9a0ff'];
    for (let i = 0; i < colors.length; i += 1) {
      const geo = new THREE.TorusGeometry(span * 0.35, 0.04, 6, 24, Math.PI * 0.55);
      const mat = new THREE.MeshBasicMaterial({ color: colors[i], transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(Math.PI / 2 + i * 0.08, 0, i * 0.4);
      mesh.position.set(x, y + 1.2 + i * 0.05, z);
      this.push(mesh, 0.75);
    }
  }
}
