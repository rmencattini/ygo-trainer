import { ImageCache, YGOPRODECK_IMAGES } from "@ygo/cards";
import { defaultImageStore } from "./imageStore";

/** Native app: Rust-side HTTP (no CORS). Browser: the Vite dev server proxy. */
export async function createImageCache(): Promise<ImageCache> {
  const store = await defaultImageStore();
  if ("__TAURI_INTERNALS__" in globalThis) {
    const { fetch } = await import("@tauri-apps/plugin-http");
    return new ImageCache(store, (url) => fetch(url), YGOPRODECK_IMAGES);
  }
  return new ImageCache(store, (url) => globalThis.fetch(url), "/ygo-images");
}
