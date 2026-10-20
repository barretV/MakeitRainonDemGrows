import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { StowKitLoader, type StowKitLoaderOptions, type StowKitPack } from '@series-inc/stowkit-three-loader';
import type * as THREE from 'three';

const packs = new Map<string, Promise<StowKitPack>>();

function runtimeBase(): URL {
  return new URL(import.meta.env.BASE_URL, window.location.href);
}

/**
 * Load a StowKit pack through the RUN.game CDN (or its local mock during dev).
 * Packs are cached for the lifetime of the page.
 */
export function loadStowKitPack(packName = 'default', renderer?: THREE.WebGLRenderer): Promise<StowKitPack> {
  const cached = packs.get(packName);
  if (cached) return cached;

  const request = (async () => {
    const blob = await RundotGameAPI.cdn.fetchAsset(`${packName}.stow`);
    const data = await blob.arrayBuffer();
    const base = runtimeBase();
    const options: StowKitLoaderOptions = {
      wasmPath: new URL('stowkit/stowkit_reader.wasm', base).href,
      basisPath: new URL('stowkit/basis/', base).href,
      dracoPath: new URL('stowkit/draco/', base).href,
      ...(renderer ? { renderer } : {}),
    };
    return StowKitLoader.loadFromMemory(data, options, `cdn:${packName}:${data.byteLength}`);
  })();

  packs.set(packName, request);
  request.catch(() => packs.delete(packName));
  return request;
}
