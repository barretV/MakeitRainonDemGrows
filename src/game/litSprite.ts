import * as THREE from 'three';
import { normalOf } from './normals';

const LIT_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vT;
  varying vec3 vB;
  varying vec3 vN;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 t = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
    vec3 b = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
    vec3 n = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
    if (dot(n, cameraPosition - wp.xyz) < 0.0) {
      n = -n;
      t = -t;
    }
    vT = t;
    vB = b;
    vN = n;
    vec4 mv = viewMatrix * wp;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const LIT_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uNormal;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uColor;
  uniform vec3 uFog;
  uniform vec2 uFogRange;
  uniform float uOpacity;
  uniform float uAlpha;
  uniform float uBeacon;
  uniform vec3 uLamp;
  uniform float uLife;
  varying vec2 vUv;
  varying vec3 vT;
  varying vec3 vB;
  varying vec3 vN;
  varying float vDepth;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < uAlpha) discard;
    vec3 albedo = pow(tex.rgb, vec3(2.2));
    vec3 nTex = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
    vec3 N = normalize(vT * nTex.x + vB * nTex.y + vN * nTex.z);
    float wrap = clamp(dot(N, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
    float shade = mix(0.86, 1.16, wrap);
    float lamp = clamp(uBeacon, 0.0, 1.0);
    shade = mix(shade, mix(1.05, 1.38, wrap), lamp);
    vec3 col = albedo * uColor * shade;
    float rim = pow(wrap, 2.4) * clamp(1.0 - nTex.z, 0.0, 1.0);
    col += albedo * uSunColor * rim * mix(0.22, 0.62, lamp);
    float fres = pow(clamp(1.0 - nTex.z, 0.0, 1.0), 1.25);
    col += uLamp * fres * uBeacon * 0.7;
    col += albedo * uLamp * uBeacon * 0.28;
    // Alive foliage holds the sun. Edges go lime-gold; the shaded body stays
    // deep emerald. Dead sprites leave uLife at 0 and skip both terms.
    float foliage = smoothstep(0.04, 0.2, albedo.g - max(albedo.r, albedo.b));
    float edge = clamp(1.0 - nTex.z, 0.0, 1.0);
    float sunFace = clamp(dot(N, normalize(uSunDir)), 0.0, 1.0);
    col += vec3(0.72, 1.2, 0.42) * sunFace * edge * foliage * uLife * 0.34;
    float core = smoothstep(0.2, 0.75, nTex.z) * (1.0 - sunFace);
    col = mix(col, col * vec3(0.42, 0.72, 0.36), core * foliage * uLife * 0.5);
    float fromBelow = clamp(0.55 - nTex.y, 0.0, 1.0);
    col += vec3(0.42, 0.9, 0.36) * fromBelow * uLife * 0.32;
    col += vec3(1.05, 0.95, 0.5) * fromBelow * edge * foliage * uLife * 0.16;
    col = mix(col, uFog, smoothstep(uFogRange.x, uFogRange.y, vDepth));
    gl_FragColor = vec4(col, tex.a * uOpacity);
  }
`;

/** Camera-facing pixel sprite lit by the shared sun. Normals live in the card's plane. */
export function makeLitSprite(
  map: THREE.Texture,
  sunDir: THREE.Vector3,
  sunColor: THREE.Color,
  alphaTest: number,
  fog?: { color: THREE.Color; near: number; far: number },
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: map },
      uNormal: { value: normalOf(map) },
      uSunDir: { value: sunDir },
      uSunColor: { value: sunColor },
      uColor: { value: new THREE.Color('#ffffff') },
      uFog: { value: fog?.color ?? new THREE.Color('#000000') },
      uFogRange: { value: new THREE.Vector2(fog?.near ?? 1000, fog?.far ?? 2000) },
      uOpacity: { value: 1 },
      uAlpha: { value: alphaTest },
      uBeacon: { value: 0 },
      uLamp: { value: new THREE.Color('#ffe0a0') },
      uLife: { value: 0 },
    },
    vertexShader: LIT_VERT,
    fragmentShader: LIT_FRAG,
  });
}

export function setLitMap(mat: THREE.ShaderMaterial, map: THREE.Texture): void {
  mat.uniforms['uMap']!.value = map;
  mat.uniforms['uNormal']!.value = normalOf(map);
}

export function litColor(mat: THREE.Material): THREE.Color {
  return (mat as THREE.ShaderMaterial).uniforms['uColor']!.value as THREE.Color;
}

export function litOpacity(mat: THREE.Material): { value: number } {
  return (mat as THREE.ShaderMaterial).uniforms['uOpacity'] as { value: number };
}

/** 0 = dusk litter, 1 = a grown crown that holds sun and meadow bounce. */
export function litLife(mat: THREE.Material, value: number): void {
  const uniform = (mat as THREE.ShaderMaterial).uniforms?.['uLife'] as { value: number } | undefined;
  if (uniform) uniform.value = value;
}

const POND_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vT;
  varying vec3 vB;
  varying vec3 vN;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec3 t = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
    vec3 b = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
    vec3 n = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
    if (dot(n, cameraPosition - wp.xyz) < 0.0) {
      n = -n;
      t = -t;
    }
    vT = t;
    vB = b;
    vN = n;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const POND_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uRain;
  uniform float uFill;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vT;
  varying vec3 vB;
  varying vec3 vN;

  vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }

  void main() {
    vec2 pix = floor(vUv * vec2(48.0, 32.0));
    vec2 uv = (pix + 0.5) / vec2(48.0, 32.0);
    vec2 p = uv * 2.0 - 1.0;
    float d = length(p / vec2(0.92, 0.62));
    if (d > 1.0) discard;
    float calm = smoothstep(0.35, 0.98, uFill);
    float t = uTime * mix(1.0, 0.42, calm);
    float sx = sin(pix.x * 0.55 + t * 1.15);
    float sz = sin(pix.y * 0.62 - t * 0.95);
    float ripple = sx * sz;
    float rx = sin(pix.x * 1.1 + t * 2.8);
    float rz = sin(pix.y * 0.95 - t * 2.4);
    float hx = cos(pix.x * 0.55 + t * 1.15) * sz * 0.65 + uRain * 1.2 * cos(pix.x * 1.1 + t * 2.8) * rz;
    float hy = sx * cos(pix.y * 0.62 - t * 0.95) * 0.65 + uRain * 1.0 * rx * cos(pix.y * 0.95 - t * 2.4);
    vec3 nTex = normalize(vec3(hx, hy, 2.8));
    vec3 N = normalize(vT * nTex.x + vB * nTex.y + vN * nTex.z);
    vec3 sun = normalize(uSunDir);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float spec = pow(max(dot(N, normalize(sun + viewDir)), 0.0), mix(22.0, 36.0, calm));
    float band = floor((1.0 - d) * 4.0) / 3.0;
    vec3 deep = srgb(vec3(0.08, 0.48, 0.78));
    vec3 mid = srgb(vec3(0.22, 0.74, 1.0));
    vec3 shallow = srgb(vec3(0.62, 0.92, 1.0));
    vec3 jewel = srgb(vec3(0.35, 0.88, 0.95));
    vec3 col = mix(deep, mid, clamp(band, 0.0, 1.0));
    col = mix(col, shallow, smoothstep(0.45, 0.85, band));
    col = mix(col, jewel, calm * smoothstep(0.2, 0.75, 1.0 - d));
    col += uSunColor * spec * (0.45 + uRain * 0.28 + calm * 0.55);
    col += srgb(vec3(0.85, 0.95, 1.0)) * pow(max(ripple, 0.0), 8.0) * mix(0.14, 0.28, calm);
    float caust =
      sin(uv.x * 14.0 + t * 0.55) * sin(uv.y * 11.0 - t * 0.48) * 0.5 + 0.5;
    col += srgb(vec3(0.75, 0.98, 1.0)) * caust * calm * (1.0 - d) * 0.22;
    float rings = 0.0;
    for (int i = 0; i < 3; i++) {
      float ph = fract(t * 0.22 + float(i) * 0.37);
      vec2 c = vec2(sin(float(i) * 2.4), cos(float(i) * 1.7)) * 0.28;
      float rd = abs(length(p - c) - ph * 0.85);
      rings += (1.0 - smoothstep(0.0, 0.06, rd)) * (1.0 - ph);
    }
    col += srgb(vec3(0.82, 0.95, 1.0)) * rings * mix(uRain * 0.55, 0.15, calm);
    float sparkle = pow(max(sin(uv.x * 90.0 + t * 1.8) * sin(uv.y * 70.0 - t * 1.4), 0.0), 18.0);
    col += srgb(vec3(1.0, 1.0, 0.98)) * sparkle * calm * 0.35;
    float rim = smoothstep(0.78, 1.0, d);
    col = mix(col, srgb(vec3(0.92, 0.98, 1.0)), rim * mix(0.55, 0.88, calm));
    float alpha = smoothstep(1.0, 0.88, d) * mix(0.88, 0.97, calm);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function makePondWater(time: { value: number }, sunDir: THREE.Vector3, sunColor: THREE.Color, rain: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: time,
      uSunDir: { value: sunDir },
      uSunColor: { value: sunColor },
      uRain: rain,
      uFill: { value: 0 },
    },
    vertexShader: POND_VERT,
    fragmentShader: POND_FRAG,
  });
}

export function setPondFill(mat: THREE.Material, fill: number): void {
  const u = (mat as THREE.ShaderMaterial).uniforms['uFill'];
  if (u) u.value = fill;
}
