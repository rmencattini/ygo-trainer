import { CardCatalog, type BaseCard } from "@ygo/cards";
import { describe, expect, it, vi } from "vitest";
import {
  engineSources,
  fetchScripts,
  scriptNames,
  textSource,
} from "./loadDuel";

const base: BaseCard = {
  code: 0,
  alias: 0,
  name: "",
  desc: "",
  type: 0x21,
  level: 4,
  attribute: 32,
  race: 1,
  atk: 1800,
  def: 0,
};
const catalog = new CardCatalog(
  [
    {
      ...base,
      code: 14558127,
      name: "Ash Blossom & Joyous Spring",
      setcode: "4294967297",
      strings: ["Negate that effect"],
    },
    {
      ...base,
      code: 14558128,
      alias: 14558127,
      name: "Ash Blossom & Joyous Spring",
    },
    { ...base, code: 69247929, name: "Gene-Warped Warwolf", type: 0x11 },
  ],
  {},
);
const strings = {
  system: { 500: "Select the card(s) to Tribute" },
  victory: {},
  counter: {},
  setname: {},
};

describe("scriptNames", () => {
  it("lists one official script per card in the decks, including alias originals", () => {
    const names = scriptNames(
      [{ main: [14558128, 69247929, 69247929], extra: [], side: [] }],
      catalog,
    );
    expect(names.sort()).toEqual([
      "official/c14558127.lua",
      "official/c14558128.lua",
      "official/c69247929.lua",
    ]);
  });
});

describe("fetchScripts", () => {
  it("loads root helpers and card scripts, skipping the ones that do not exist", async () => {
    const files: Record<string, string> = {
      "/scripts/index.json": JSON.stringify(["constant.lua", "utility.lua"]),
      "/scripts/constant.lua": "-- c",
      "/scripts/utility.lua": "-- u",
      "/scripts/official/c1.lua": "-- one",
    };
    const fetch = vi.fn(async (url: string) =>
      url in files
        ? new Response(files[url])
        : new Response("", { status: 404 }),
    );
    const scripts = await fetchScripts(
      ["official/c1.lua", "official/c2.lua"],
      fetch,
    );
    expect([...scripts.keys()].sort()).toEqual([
      "constant.lua",
      "official/c1.lua",
      "utility.lua",
    ]);
  });
});

describe("engineSources", () => {
  const sources = engineSources(
    catalog,
    new Map([
      ["official/c14558127.lua", "-- ash"],
      ["utility.lua", "-- u"],
    ]),
  );

  it("gives the engine card data with unpacked setcodes", () => {
    expect(sources.readCard(14558127)).toMatchObject({
      code: 14558127,
      setcodes: [1, 1],
      attack: 1800,
      level: 4,
    });
    expect(sources.readCard(1)).toBeNull();
  });

  it("finds card scripts under official/ and helpers at the root", () => {
    expect(sources.readScript("c14558127.lua")).toBe("-- ash");
    expect(sources.readScript("utility.lua")).toBe("-- u");
    expect(sources.readScript("c69247929.lua")).toBeNull();
  });
});

describe("textSource", () => {
  const texts = textSource(catalog, strings);

  it("names cards and reads their effect and system strings", () => {
    expect(texts.name(69247929)).toBe("Gene-Warped Warwolf");
    expect(texts.name(5)).toBe("Card 5");
    expect(texts.cardString(14558127, 0)).toBe("Negate that effect");
    expect(texts.cardString(14558128, 0)).toBe("Negate that effect");
    expect(texts.system(500)).toBe("Select the card(s) to Tribute");
  });
});
