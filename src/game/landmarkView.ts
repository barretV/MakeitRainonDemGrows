import * as THREE from 'three';
import type { ArtSet } from './pixels';
import { landmarkTexture } from './landmarkArt';
import type { LandmarkDef } from './landmarks';

export interface LandmarkKit {
  art: ArtSet;
  sprite: (map: THREE.Texture, w: number, h: number, x: number, y: number, z: number, noFog?: boolean) => THREE.Mesh;
  glow: (kind: 'shaft' | 'halo' | 'soft') => THREE.Texture;
}

function stand(
  kit: LandmarkKit,
  parent: THREE.Object3D,
  map: THREE.Texture,
  w: number,
  h: number,
  x: number,
  z: number,
  lift = 0,
  noFog = false,
  layer = 1,
): THREE.Mesh {
  const mesh = kit.sprite(map, w, h, x, h * 0.5 + lift, z, noFog);
  mesh.userData['layer'] = layer;
  parent.add(mesh);
  return mesh;
}

function disc(parent: THREE.Object3D, radius: number, color: string, y = 0.1, layer = 1): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 28),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.userData['tint'] = 1;
  mesh.userData['layer'] = layer;
  mesh.userData['baseColor'] = new THREE.Color(color);
  mesh.userData['tintColor'] = new THREE.Color(color);
  parent.add(mesh);
  return mesh;
}

function dimGlow(mesh: THREE.Mesh): void {
  const mat = mesh.material as THREE.ShaderMaterial;
  if (mat.uniforms?.['uOpacity']) mat.uniforms['uOpacity'].value = 0.04;
}

function pigment(mesh: THREE.Mesh, color: string): void {
  mesh.userData['tint'] = 1;
  mesh.userData['baseColor'] = new THREE.Color(color);
  mesh.userData['tintColor'] = new THREE.Color(color);
}

/** Builds the landmark's meshes in local space. The caller plants the group on the island. */
export function buildLandmarkGroup(def: LandmarkDef, kit: LandmarkKit): THREE.Group {
  const root = new THREE.Group();
  root.name = def.id;
  switch (def.art) {
    case 'stream':
      // The brook itself is the living ribbon. This marker is only the heart of it.
      break;
    case 'oak':
      stand(kit, root, landmarkTexture('oak'), 2.4, 3.6, 0, 0);
      break;
    case 'mill': {
      stand(kit, root, landmarkTexture('mill'), 2.5, 3.2, -0.15, 0);
      const pivot = new THREE.Group();
      pivot.userData['bb'] = 1;
      pivot.userData['layer'] = 2;
      pivot.position.set(0.15, 1.7, 0.2);
      const wheel = kit.sprite(landmarkTexture('wheel'), 1.45, 1.45, 0, 0, 0);
      wheel.userData['bb'] = 0;
      wheel.userData['spin'] = 1;
      pivot.add(wheel);
      root.add(pivot);
      break;
    }
    case 'lake': {
      // The frozen channel is the living ribbon. Reeds mark its banks.
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        stand(kit, root, kit.art.cattail, 0.32, 0.78, Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0, false, 3);
      }
      break;
    }
    case 'aurora':
      stand(kit, root, landmarkTexture('aurora'), 3.4, 2.8, 0, 0, 0.2, true);
      break;
    case 'igloo': {
      stand(kit, root, landmarkTexture('igloo'), 2.1, 1.7, -0.35, 0.1);
      stand(kit, root, landmarkTexture('igloo'), 1.35, 1.1, 0.85, -0.35, 0, false, 2);
      const smoke = kit.sprite(kit.art.softCloud, 0.7, 0.42, 0.05, 2.15, 0.05, true);
      smoke.userData['tint'] = 0;
      smoke.userData['smoke'] = 1;
      smoke.userData['layer'] = 3;
      smoke.userData['baseY'] = smoke.position.y;
      dimGlow(smoke);
      root.add(smoke);
      break;
    }
    case 'icefall':
      stand(kit, root, landmarkTexture('icefall'), 1.8, 3.4, 0, 0);
      break;
    case 'bears': {
      const spots = [
        { x: -0.7, z: 0.15, s: 1.15, layer: 2 },
        { x: 0.55, z: -0.1, s: 0.85, layer: 2 },
        { x: 0.15, z: 0.45, s: 0.62, layer: 3 },
      ];
      for (let i = 0; i < spots.length; i += 1) {
        const spot = spots[i]!;
        const bear = stand(kit, root, landmarkTexture('bear'), 1.35 * spot.s, 0.95 * spot.s, spot.x, spot.z, 0, false, spot.layer);
        bear.userData['bear'] = i;
        bear.userData['baseX'] = bear.position.x;
        bear.userData['baseY'] = bear.position.y;
        bear.userData['baseZ'] = bear.position.z;
      }
      disc(root, 1.55, '#e7f3fb', 0.05);
      break;
    }
    case 'dunes':
      stand(kit, root, landmarkTexture('dunes'), 4.6, 2.1, 0, 0, 0);
      break;
    case 'gate': {
      stand(kit, root, landmarkTexture('pillar'), 0.85, 3.5, -1.25, 0);
      stand(kit, root, landmarkTexture('pillar'), 0.85, 3.5, 1.25, 0);
      stand(kit, root, landmarkTexture('guardian'), 2.6, 1.45, 0, 0.55, 0, false, 2);
      stand(kit, root, kit.art.sun, 0.7, 0.7, 0, -0.05, 3.15, true, 3);
      break;
    }
    case 'oasis': {
      disc(root, 1.45, '#3ec0c8');
      stand(kit, root, landmarkTexture('palm'), 1.8, 2.6, 0.95, 0.15, 0, false, 2);
      stand(kit, root, landmarkTexture('palm'), 1.25, 1.9, -1.05, -0.2, 0, false, 3);
      break;
    }
    case 'tents': {
      stand(kit, root, landmarkTexture('tent'), 2.1, 1.55, -0.7, 0.1);
      stand(kit, root, landmarkTexture('tent'), 1.55, 1.15, 0.85, -0.25, 0, false, 2);
      break;
    }
    case 'mesa':
      stand(kit, root, landmarkTexture('mesa'), 3.1, 2.6, 0, 0);
      break;
    case 'sundial': {
      disc(root, 1.55, '#e7c56a', 0.06);
      const gnomon = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.15, 0.12),
        new THREE.MeshBasicMaterial({ color: '#8a5a32' }),
      );
      gnomon.position.set(0.12, 0.58, 0);
      gnomon.rotation.z = -0.4;
      pigment(gnomon, '#8a5a32');
      gnomon.userData['layer'] = 2;
      root.add(gnomon);
      break;
    }
    case 'barrels': {
      const row = [-1.05, 0, 1.05];
      for (let i = 0; i < row.length; i += 1) {
        stand(kit, root, landmarkTexture('barrel'), 0.85, 1.05, row[i]!, i === 1 ? 0.15 : -0.05, 0, false, i + 1);
      }
      break;
    }
    case 'reactor':
      stand(kit, root, landmarkTexture('reactor'), 2.5, 3.5, 0, 0);
      break;
    case 'pipes':
      stand(kit, root, landmarkTexture('pipes'), 4.2, 2.4, 0, 0, 0.15);
      break;
    case 'shrooms': {
      disc(root, 1.35, '#c9a6ff', 0.06);
      const spots = [
        { x: -0.55, z: 0.1, s: 1 },
        { x: 0.45, z: -0.2, s: 0.75 },
        { x: 0.1, z: 0.55, s: 0.55 },
      ];
      spots.forEach((spot, i) => {
        stand(kit, root, landmarkTexture('shroom'), 0.85 * spot.s, 0.85 * spot.s, spot.x, spot.z, 0, false, i === 2 ? 3 : 2);
      });
      break;
    }
    case 'cascade':
      stand(kit, root, landmarkTexture('cascade'), 1.9, 3.3, 0, 0);
      break;
    case 'moths': {
      stand(kit, root, landmarkTexture('chimney'), 1.15, 3.2, 0, 0);
      for (let i = 0; i < 4; i += 1) {
        const moth = kit.sprite(kit.art.butterfly, 0.42, 0.32, 0, 1.8, 0);
        moth.userData['moth'] = i;
        moth.userData['layer'] = 3;
        root.add(moth);
      }
      break;
    }
    case 'peaks': {
      stand(kit, root, kit.art.mountain, 2.2, 1.7, -1.5, 0.1, 0, false, 1);
      stand(kit, root, kit.art.mountain, 2.8, 2.3, 0.15, -0.05, 0, false, 2);
      stand(kit, root, kit.art.mountain, 1.8, 1.45, 1.55, 0.2, 0, false, 3);
      break;
    }
    case 'reef': {
      // The reef is the band that wraps the globe. Coral marks this cove.
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        stand(kit, root, landmarkTexture('coral'), 0.55, 0.7, Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0, false, i < 2 ? 2 : 3);
      }
      break;
    }
    case 'lantern': {
      stand(kit, root, landmarkTexture('lighthouse'), 1.15, 3.3, 0, 0);
      const beam = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 3.4),
        new THREE.MeshBasicMaterial({
          map: kit.glow('shaft'),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.set(0.9, 2.5, 0);
      beam.userData['beam'] = 1;
      beam.userData['layer'] = 3;
      beam.userData['tint'] = 0;
      beam.userData['bb'] = 0;
      root.add(beam);
      break;
    }
    case 'bridge': {
      stand(kit, root, kit.art.rainbow, 5.2, 2.5, 0, 0, 1.6, true);
      const crown = kit.sprite(kit.glow('halo'), 2.8, 2.8, 0, 2.8, 0, true);
      crown.userData['tint'] = 0;
      crown.userData['crown'] = 1;
      crown.userData['layer'] = 3;
      dimGlow(crown);
      root.add(crown);
      break;
    }
    case 'cairns': {
      const flair = [0, 1, 2, 3]
        .map((i) => kit.art.worldFlair[i])
        .filter((tex): tex is THREE.CanvasTexture => tex != null);
      flair.forEach((tex, i) => {
        const a = (i / Math.max(1, flair.length)) * Math.PI * 2;
        stand(kit, root, tex, 0.72, 0.98, Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0, false, (i % 3) + 1);
      });
      break;
    }
    case 'lights': {
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * Math.PI * 2;
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 10, 8),
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? '#ffe7a0' : '#9af6ff',
            transparent: true,
            opacity: 0.2,
          }),
        );
        bulb.position.set(Math.cos(a) * 1.55, 0.22, Math.sin(a) * 1.55);
        bulb.userData['light'] = 1;
        bulb.userData['layer'] = i < 3 ? 1 : i < 5 ? 2 : 3;
        bulb.userData['tint'] = 0;
        root.add(bulb);
      }
      break;
    }
    case 'worldtree': {
      stand(kit, root, landmarkTexture('worldtree'), 3.1, 4.4, 0, 0);
      const crown = kit.sprite(kit.glow('halo'), 2.6, 2.6, 0, 3.5, 0, true);
      crown.userData['tint'] = 0;
      crown.userData['crown'] = 1;
      crown.userData['layer'] = 3;
      dimGlow(crown);
      root.add(crown);
      break;
    }
    default:
      break;
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.84, 32),
    new THREE.MeshBasicMaterial({
      color: '#ffe7a0',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.14;
  ring.userData['revealRing'] = 1;
  ring.userData['tint'] = 0;
  root.add(ring);

  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 3.6),
    new THREE.MeshBasicMaterial({
      map: kit.glow('halo'),
      color: '#ffe7a0',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.16;
  pool.userData['beaconPool'] = 1;
  pool.userData['tint'] = 0;
  pool.renderOrder = 3;
  root.add(pool);

  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 4.6),
    new THREE.MeshBasicMaterial({
      map: kit.glow('shaft'),
      color: '#fff1c4',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  shaft.position.y = 2.35;
  shaft.userData['bb'] = 1;
  shaft.userData['beaconShaft'] = 1;
  shaft.userData['tint'] = 0;
  shaft.renderOrder = 2;
  root.add(shaft);
  return root;
}
