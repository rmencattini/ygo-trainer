export type ImageSize = "full" | "small";

/** Where downloaded images live: the app cache folder, browser cache, or memory in tests. */
export interface ImageStore {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, bytes: Uint8Array): Promise<void>;
}

type Fetch = (url: string) => Promise<Response>;

export const YGOPRODECK_IMAGES = "https://images.ygoprodeck.com/images";

export function imageUrl(
  code: number,
  size: ImageSize = "full",
  base = YGOPRODECK_IMAGES,
): string {
  return `${base}/${size === "full" ? "cards" : "cards_small"}/${code}.jpg`;
}

export function imageKey(code: number, size: ImageSize = "full"): string {
  return size === "full" ? `${code}.jpg` : `${code}.small.jpg`;
}

/**
 * Downloads card images once and serves them from `store` after that.
 * YGOProDeck asks clients not to hotlink, so every image goes through here.
 */
export class ImageCache {
  private readonly pending = new Map<string, Promise<Uint8Array | null>>();

  constructor(
    private readonly store: ImageStore,
    private readonly fetch: Fetch = (url) => globalThis.fetch(url),
    private readonly base = YGOPRODECK_IMAGES,
  ) {}

  get(code: number, size: ImageSize = "full"): Promise<Uint8Array | null> {
    const key = imageKey(code, size);
    let job = this.pending.get(key);
    if (!job) {
      job = this.load(key, imageUrl(code, size, this.base)).finally(() =>
        this.pending.delete(key),
      );
      this.pending.set(key, job);
    }
    return job;
  }

  private async load(key: string, url: string): Promise<Uint8Array | null> {
    const cached = await this.store.get(key);
    if (cached) return cached;
    const response = await this.fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    await this.store.put(key, bytes);
    return bytes;
  }
}
