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

    exportCards({
      cdb: join(DATA, "cdb", "cards.cdb"),
      localeDir,
      out,
      stringsConf: join(DATA, "strings.conf"),
      decksDir: join(DATA, "decks"),
    });

    const en = JSON.parse(readFileSync(join(out, "en.json"), "utf8"));
    expect(en.find((c) => c.code === 89631139)).toMatchObject({
      name: "Blue-Eyes White Dragon",
      atk: 3000,
      level: 8,
    });
    expect(en.length).toBeGreaterThan(10000);
    // Engine needs the packed setcode (as a string: it can exceed 2^53) and effect strings.
    expect(en.find((c) => c.code === 89631139).setcode).toBe("221");
    const ash = en.find((c) => c.code === 14558127);
    expect(ash.strings[0]).toMatch(/negate/i);
    expect(en.find((c) => c.code === 89631139).strings).toBeUndefined();
    expect(
      JSON.parse(readFileSync(join(out, "strings.json"), "utf8")).system[500],
    ).toBe("Select the card(s) to Tribute");
    expect(
      readFileSync(join(out, "..", "decks", "m1-vanilla.ydk"), "utf8"),
    ).toContain("#main");
    const decks = JSON.parse(
      readFileSync(join(out, "..", "decks", "index.json"), "utf8"),
    );
    expect(decks).toContainEqual({
      file: "m1-vanilla.ydk",
      name: "Vanilla test deck",
      preset: false,
    });
    const presets = decks.filter((d) => d.preset);
    expect(presets.length).toBeGreaterThanOrEqual(4);
    expect(presets[0]).toMatchObject({
      file: expect.stringMatching(/^presets\/.+\.ydk$/),
      name: expect.any(String),
    });
    expect(
      readFileSync(join(out, "..", "decks", presets[0].file), "utf8"),
    ).toContain("#main");
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
      stringsConf: join(DATA, "strings.conf"),
      decksDir: join(DATA, "decks"),
    });
    expect(JSON.parse(readFileSync(join(out, "index.json"), "utf8"))).toEqual({
      langs: [],
    });
  });
});
