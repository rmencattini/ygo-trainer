// Real BabelCDB + a French fixture: the same card in EN and FR.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FsImageStore, loadCatalog } from "../src/node";

const DATA = join(__dirname, "..", "..", "..", "data");
const FIXTURES = join(__dirname, "fixtures");

describe("loadCatalog", () => {
  it("shows Blue-Eyes in English from the cdb and in French from the locale file", () => {
    const catalog = loadCatalog({
      cdb: join(DATA, "cdb", "cards.cdb"),
      localeDir: FIXTURES,
    });
    expect(catalog.get(89631139)).toMatchObject({
      name: "Blue-Eyes White Dragon",
      atk: 3000,
      def: 2500,
      level: 8,
    });
    expect(catalog.get(89631139, "fr")).toMatchObject({
      name: "Dragon Blanc aux Yeux Bleus",
      atk: 3000,
    });
    expect(catalog.languages()).toEqual(["en", "fr"]);
  });

  it("works without a locale folder", () => {
    const catalog = loadCatalog({
      cdb: join(DATA, "cdb", "cards.cdb"),
      localeDir: join(FIXTURES, "missing"),
    });
    expect(catalog.languages()).toEqual(["en"]);
    expect(catalog.get(46986414, "fr")).toMatchObject({
      name: "Dark Magician",
      fallback: true,
    });
  });
});

describe("FsImageStore", () => {
  it("writes and reads back image bytes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ygo-img-"));
    const store = new FsImageStore(dir);
    expect(await store.get("1.jpg")).toBeNull();
    await store.put("1.jpg", new Uint8Array([9, 8]));
    expect(await store.get("1.jpg")).toEqual(new Uint8Array([9, 8]));
    expect([...readFileSync(join(dir, "1.jpg"))]).toEqual([9, 8]);
  });

  it("rejects keys that could leave the cache folder", async () => {
    const store = new FsImageStore(mkdtempSync(join(tmpdir(), "ygo-img-")));
    await expect(store.put("../x.jpg", new Uint8Array())).rejects.toThrow(
      /key/,
    );
  });
});
