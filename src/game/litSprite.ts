import * as THREE from 'three';
import { normalOf } from './normals';

const LIT_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vT;
  varying vec3 vB;
  varying vec3 vN;
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
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const LIT_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uNormal;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uAlpha;
  varying vec2 vUv;
  varying vec3 vT;
  varying vec3 vB;
  varying vec3 vN;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < uAlpha) discard;
    vec3 albedo = pow(tex.rgb, vec3(2.2));
    vec3 nTex = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
    vec3 N = normalize(vT * nTex.x + vB * nTex.y + vN * nTex.z);
    float wrap = clamp(dot(N, normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0);
    float shade = mix(0.86, 1.16, wrap);
    vec3 col = albedo * uColor * shade;
    float rim = pow(wrap, 2.4) * clamp(1.0 - nTex.z, 0.0, 1.0);
    col += albedo * uSunColor * rim * 0.22;
    gl_FragColor = vec4(col, tex.a * uOpacity);
  }
`;

/** Camera-facing pixel sprite lit by the shared sun. Normals live in the card's plane. */
export function makeLitSprite(
  map: THREE.Texture,
  sunDir: THREE.Vector3,
  sunColor: THREE.Color,
  alphaTest: number,
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
      uOpacity: { value: 1 },
      uAlpha: { value: alphaTest },
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
    float t = uTime;
    float sx = sin(pix.x * 0.85 + t * 2.3);
    float sz = sin(pix.y * 0.95 - t * 1.8);
    float ripple = sx * sz;
    float rx = sin(pix.x * 1.7 + t * 5.4);
    float rz = sin(pix.y * 1.5 - t * 4.6);
    float hx = cos(pix.x * 0.85 + t * 2.3) * sz + uRain * 1.6 * cos(pix.x * 1.7 + t * 5.4) * rz;
    float hy = sx * cos(pix.y * 0.95 - t * 1.8) + uRain * 1.4 * rx * cos(pix.y * 1.5 - t * 4.6);
    vec3 nTex = normalize(vec3(hx, hy, 2.4));
    vec3 N = normalize(vT * nTex.x + vB * nTex.y + vN * nTex.z);
    vec3 sun = normalize(uSunDir);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float spec = pow(max(dot(N, normalize(sun + viewDir)), 0.0), 28.0);
    float band = floor((1.0 - d) * 4.0) / 3.0;
    vec3 deep = srgb(vec3(0.10, 0.55, 0.82));
    vec3 mid = srgb(vec3(0.24, 0.77, 1.0));
    vec3 shallow = srgb(vec3(0.55, 0.88, 1.0));
    vec3 col = mix(deep, mid, clamp(band, 0.0, 1.0));
    col = mix(col, shallow, smoothstep(0.45, 0.85, band));
    col += uSunColor * spec * (0.55 + uRain * 0.35);
    col += srgb(vec3(0.85, 0.95, 1.0)) * pow(max(ripple, 0.0), 8.0) * 0.18;
    float rings = 0.0;
    for (int i = 0; i < 3; i++) {
      float ph = fract(t * 0.33 + float(i) * 0.37);
      vec2 c = vec2(sin(float(i) * 2.4), cos(float(i) * 1.7)) * 0.28;
      float rd = abs(length(p - c) - ph * 0.85);
      rings += (1.0 - smoothstep(0.0, 0.07, rd)) * (1.0 - ph);
    }
    col += srgb(vec3(0.82, 0.95, 1.0)) * rings * uRain * 0.7;
    float rim = smoothstep(0.78, 1.0, d);
    col = mix(col, srgb(vec3(0.88, 0.96, 1.0)), rim * 0.72);
    float alpha = smoothstep(1.0, 0.9, d) * 0.94;
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
    },
    vertexShader: POND_VERT,
    fragmentShader: POND_FRAG,
  });
}
