import { describe, expect, it } from "vitest";
import { CardCatalog, type BaseCard } from "./catalog";

const blueEyes: BaseCard = {
  code: 89631139,
  alias: 0,
  name: "Blue-Eyes White Dragon",
  desc: "This legendary dragon is a powerful engine of destruction.",
  type: 0x11,
  level: 8,
  attribute: 16,
  race: 8192,
  atk: 3000,
  def: 2500,
};
const blueEyesAlt: BaseCard = { ...blueEyes, code: 89631140, alias: 89631139 };
const warwolf: BaseCard = {
  ...blueEyes,
  code: 69247929,
  name: "Gene-Warped Warwolf",
  desc: "Wolf.",
  level: 4,
};

const catalog = new CardCatalog([blueEyes, blueEyesAlt, warwolf], {
  fr: {
    "89631139": {
      name: "Dragon Blanc aux Yeux Bleus",
      desc: "Ce dragon légendaire.",
    },
  },
});

describe("CardCatalog.get", () => {
  it("returns English text and stats by default", () => {
    expect(catalog.get(89631139)).toMatchObject({
      code: 89631139,
      lang: "en",
      fallback: false,
      name: "Blue-Eyes White Dragon",
      atk: 3000,
      level: 8,
    });
  });

  it("returns the same card in French", () => {
    expect(catalog.get(89631139, "fr")).toMatchObject({
      lang: "fr",
      fallback: false,
      name: "Dragon Blanc aux Yeux Bleus",
      desc: "Ce dragon légendaire.",
      atk: 3000,
    });
  });

  it("falls back to English when the language has no text for the card", () => {
    expect(catalog.get(69247929, "fr")).toMatchObject({
      lang: "en",
      fallback: true,
      name: "Gene-Warped Warwolf",
    });
  });

  it("uses the alias text for alternate artworks", () => {
    expect(catalog.get(89631140, "fr")).toMatchObject({
      code: 89631140,
      name: "Dragon Blanc aux Yeux Bleus",
    });
  });

  it("returns null for an unknown passcode", () => {
    expect(catalog.get(1)).toBeNull();
  });

  it("lists the languages it can show", () => {
    expect(catalog.languages()).toEqual(["en", "fr"]);
  });
});

describe("CardCatalog.search", () => {
  it("finds cards by part of the name, ignoring case", () => {
    expect(catalog.search("blue-eyes").map((c) => c.code)).toEqual([89631139]);
  });

  it("searches the chosen language and ignores accents", () => {
    expect(catalog.search("dragon blanc", "fr").map((c) => c.name)).toEqual([
      "Dragon Blanc aux Yeux Bleus",
    ]);
    expect(catalog.search("legendaire", "fr")).toEqual([]);
    expect(catalog.search("yeux", "fr")).toHaveLength(1);
  });

  it("skips alternate artworks and caps the result count", () => {
    expect(catalog.search("", "en", 2)).toHaveLength(2);
    expect(catalog.search("dragon").map((c) => c.code)).not.toContain(89631140);
  });
});
