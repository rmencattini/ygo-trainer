import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportCards } from "./cards-export.mjs";

const DATA = join(import.meta.dirname, "..", "data");

describe("exportCards", () => {
  it("writes English cards from the cdb, copies locale files and lists them", () => {
    const localeDir = mkdtempSync(join(tmpdir(), "ygo-locale-"));
    writeFileSync(
      join(localeDir, "fr.json"),
      JSON.stringify({ 89631139: { name: "Dragon", desc: "" } }),
    );
    const out = join(mkdtempSync(join(tmpdir(), "ygo-out-")), "cards");
    mkdirSync(out);

    exportCards({ cdb: join(DATA, "cdb", "cards.cdb"), localeDir, out });

    const en = JSON.parse(readFileSync(join(out, "en.json"), "utf8"));
    expect(en.find((c) => c.code === 89631139)).toMatchObject({
      name: "Blue-Eyes White Dragon",
      atk: 3000,
      level: 8,
    });
    expect(en.length).toBeGreaterThan(10000);
    expect(
      JSON.parse(readFileSync(join(out, "fr.json"), "utf8"))[89631139].name,
    ).toBe("Dragon");
    expect(JSON.parse(readFileSync(join(out, "index.json"), "utf8"))).toEqual({
      langs: ["fr"],
    });
  });

  it("lists no languages when the locale folder is missing", () => {
    const out = mkdtempSync(join(tmpdir(), "ygo-out-"));
    exportCards({
      cdb: join(DATA, "cdb", "cards.cdb"),
      localeDir: join(out, "nope"),
      out,
    });
    expect(JSON.parse(readFileSync(join(out, "index.json"), "utf8"))).toEqual({
      langs: [],
    });
  });
});
