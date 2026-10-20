import * as THREE from 'three';

const normalOfColor = new WeakMap<THREE.Texture, THREE.Texture>();
let flatNormal: THREE.CanvasTexture | null = null;

/** Pair a color texture with the normal map baked from the same canvas. */
export function rememberNormal(color: THREE.Texture, normal: THREE.Texture): void {
  normalOfColor.set(color, normal);
}

export function normalOf(color: THREE.Texture): THREE.Texture {
  return normalOfColor.get(color) ?? flat();
}

function flat(): THREE.CanvasTexture {
  if (flatNormal) return flatNormal;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, 1, 1);
  }
  flatNormal = new THREE.CanvasTexture(canvas);
  flatNormal.magFilter = THREE.NearestFilter;
  flatNormal.minFilter = THREE.NearestFilter;
  flatNormal.generateMipmaps = false;
  flatNormal.colorSpace = THREE.NoColorSpace;
  flatNormal.needsUpdate = true;
  return flatNormal;
}

/**
 * Guess a pixel-art normal map from a sprite canvas.
 * Height is a short inward bevel plus the painted brightness.
 * Each pixel snaps to 8 directions and two tilts, plus flat.
 * OpenGL green-up. The texture is data, not color.
 */
export function bakeSpriteNormal(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const w = canvas.width;
  const h = canvas.height;
  const srcCtx = canvas.getContext('2d');
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const dst = out.getContext('2d');
  if (!srcCtx || !dst || w < 1 || h < 1) return flat();

  const src = srcCtx.getImageData(0, 0, w, h);
  const height = new Float32Array(w * h);
  const alpha = src.data;
  const bevel = 2;

  const opaque = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return (alpha[(y * w + x) * 4 + 3] ?? 0) >= 20;
  };

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (!opaque(x, y)) continue;
      let minD = bevel + 0.01;
      for (let oy = -bevel; oy <= bevel; oy += 1) {
        for (let ox = -bevel; ox <= bevel; ox += 1) {
          if (opaque(x + ox, y + oy)) continue;
          const d = Math.hypot(ox, oy);
          if (d < minD) minD = d;
        }
      }
      const shape = Math.min(minD, 1.5) / 1.5;
      const pi = i * 4;
      const lum = ((alpha[pi] ?? 0) * 0.299 + (alpha[pi + 1] ?? 0) * 0.587 + (alpha[pi + 2] ?? 0) * 0.114) / 255;
      height[i] = shape * 0.72 + lum * 0.28;
    }
  }

  const sample = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return height[y * w + x] ?? 0;
  };

  const img = dst.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const o = i * 4;
      const a = alpha[o + 3] ?? 0;
      if (a < 20) {
        img.data[o] = 128;
        img.data[o + 1] = 128;
        img.data[o + 2] = 255;
        img.data[o + 3] = 0;
        continue;
      }
      const dhdx = (sample(x + 1, y) - sample(x - 1, y)) * 0.5;
      // Canvas Y grows downward. Visual up is the OpenGL green channel.
      const dhdUp = (sample(x, y - 1) - sample(x, y + 1)) * 0.5;
      const nx = -dhdx * 2.4;
      const ny = -dhdUp * 2.4;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const q = quantize(nx / len, ny / len, nz / len);
      img.data[o] = Math.round(q[0] * 127.5 + 128);
      img.data[o + 1] = Math.round(q[1] * 127.5 + 128);
      img.data[o + 2] = Math.round(q[2] * 127.5 + 128);
      img.data[o + 3] = a;
    }
  }
  dst.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(out);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 8 headings, tilts of 30° and 60°, and flat. Steep ramps stay banded. */
function quantize(nx: number, ny: number, nz: number): [number, number, number] {
  const tilt = Math.acos(Math.min(1, Math.max(-1, nz))) * (180 / Math.PI);
  if (tilt < 15 || nx * nx + ny * ny < 1e-8) return [0, 0, 1];
  const step = tilt < 45 ? 30 : 60;
  const rad = (step * Math.PI) / 180;
  const eighth = Math.PI / 4;
  const ang = Math.round(Math.atan2(ny, nx) / eighth) * eighth;
  const s = Math.sin(rad);
  return [Math.cos(ang) * s, Math.sin(ang) * s, Math.cos(rad)];
}
