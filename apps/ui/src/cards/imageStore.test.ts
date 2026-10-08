import { describe, expect, it, vi } from "vitest";
import { browserImageStore, tauriImageStore } from "./imageStore";

describe("tauriImageStore", () => {
  it("reads raw bytes and treats an empty reply as a miss", async () => {
    const invoke = vi.fn(async (_cmd: string, args?: unknown) =>
      (args as { key: string }).key === "1.jpg"
        ? new Uint8Array([4, 2]).buffer
        : new ArrayBuffer(0),
    );
    const store = tauriImageStore(invoke);
    expect(await store.get("1.jpg")).toEqual(new Uint8Array([4, 2]));
    expect(await store.get("2.jpg")).toBeNull();
    expect(invoke).toHaveBeenCalledWith("image_cache_read", { key: "1.jpg" });
  });

  it("writes bytes as a raw body with the key in a header", async () => {
    const invoke = vi.fn(async () => undefined);
    const bytes = new Uint8Array([7]);
    await tauriImageStore(invoke).put("7.jpg", bytes);
    expect(invoke).toHaveBeenCalledWith("image_cache_write", bytes, {
      headers: { "x-image-key": "7.jpg" },
    });
  });
});

describe("browserImageStore", () => {
  it("stores bytes in Cache Storage under a stable URL", async () => {
    const entries = new Map<string, Response>();
    const cache = {
      match: async (url: string) => entries.get(url)?.clone(),
      put: async (url: string, response: Response) =>
        void entries.set(url, response),
    };
    const store = browserImageStore({
      open: async () => cache,
    } as unknown as CacheStorage);
    expect(await store.get("1.jpg")).toBeNull();
    await store.put("1.jpg", new Uint8Array([1, 2]));
    expect(await store.get("1.jpg")).toEqual(new Uint8Array([1, 2]));
    expect([...entries.keys()]).toEqual(["/__card-images/1.jpg"]);
  });
});
