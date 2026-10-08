import type { ImageStore } from "@ygo/cards";

type Invoke = (
  cmd: string,
  args?: unknown,
  options?: { headers: Record<string, string> },
) => Promise<unknown>;

/** Native app: files in the app cache folder, through the Rust `image_cache_*` commands. */
export function tauriImageStore(invoke: Invoke): ImageStore {
  return {
    async get(key) {
      const bytes = new Uint8Array(
        (await invoke("image_cache_read", { key })) as ArrayBuffer,
      );
      return bytes.length ? bytes : null;
    },
    async put(key, bytes) {
      await invoke("image_cache_write", bytes, {
        headers: { "x-image-key": key },
      });
    },
  };
}

/** Browser (dev server, Playwright): Cache Storage. */
export function browserImageStore(
  caches: CacheStorage = globalThis.caches,
): ImageStore {
  const open = () => caches.open("card-images");
  const url = (key: string) => `/__card-images/${key}`;
  return {
    async get(key) {
      const hit = await (await open()).match(url(key));
      return hit ? new Uint8Array(await hit.arrayBuffer()) : null;
    },
    async put(key, bytes) {
      await (await open()).put(url(key), new Response(bytes as BlobPart));
    },
  };
}

export async function defaultImageStore(): Promise<ImageStore> {
  if ("__TAURI_INTERNALS__" in globalThis) {
    const { invoke } = await import("@tauri-apps/api/core");
    return tauriImageStore(invoke as Invoke);
  }
  return browserImageStore();
}
