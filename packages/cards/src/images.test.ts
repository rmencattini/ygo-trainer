import { describe, expect, it, vi } from "vitest";
import { ImageCache, imageUrl, type ImageStore } from "./images";

function memoryStore(): ImageStore & { data: Map<string, Uint8Array> } {
  const data = new Map<string, Uint8Array>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    put: async (key, bytes) => void data.set(key, bytes),
  };
}

const bytes = new Uint8Array([1, 2, 3]);
const okFetch = () => vi.fn(async () => new Response(bytes, { status: 200 }));

describe("imageUrl", () => {
  it("points at YGOProDeck full and small images", () => {
    expect(imageUrl(89631139)).toBe(
      "https://images.ygoprodeck.com/images/cards/89631139.jpg",
    );
    expect(imageUrl(89631139, "small")).toBe(
      "https://images.ygoprodeck.com/images/cards_small/89631139.jpg",
    );
  });
});

describe("ImageCache", () => {
  it("downloads a missing image once and stores it", async () => {
    const store = memoryStore();
    const fetch = okFetch();
    const cache = new ImageCache(store, fetch);
    expect(await cache.get(89631139)).toEqual(bytes);
    expect(await cache.get(89631139)).toEqual(bytes);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.data.has("89631139.jpg")).toBe(true);
  });

  it("keeps full and small images apart", async () => {
    const store = memoryStore();
    const cache = new ImageCache(store, okFetch());
    await cache.get(1, "small");
    expect([...store.data.keys()]).toEqual(["1.small.jpg"]);
  });

  it("shares one download between requests made at the same time", async () => {
    const fetch = okFetch();
    const cache = new ImageCache(memoryStore(), fetch);
    await Promise.all([cache.get(5), cache.get(5), cache.get(5)]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns null and stores nothing when the download fails", async () => {
    const store = memoryStore();
    const fetch = vi.fn(async () => new Response("nope", { status: 404 }));
    const cache = new ImageCache(store, fetch);
    expect(await cache.get(7)).toBeNull();
    expect(store.data.size).toBe(0);
    // A later call tries again instead of remembering the failure.
    await cache.get(7);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
