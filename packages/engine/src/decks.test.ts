import { describe, expect, it } from "vitest";
import {
  isYgoprodeckDeckUrl,
  parseYdke,
  parseYgoprodeckPage,
  readYdkMeta,
  toYdk,
  validateDeck,
} from "./decks";
import { parseYdk } from "./ydk";

const b64 = (codes: number[]) =>
  Buffer.from(new Uint32Array(codes).buffer).toString("base64");

describe("toYdk / readYdkMeta", () => {
  it("writes a .ydk that parses back, with name and source in comments", () => {
    const deck = { main: [1, 2], extra: [3], side: [4] };
    const text = toYdk(deck, {
      name: "Blitzclique",
      source: "https://ygoprodeck.com/deck/x-1",
      event: "YCS, 1st",
    });
    expect(parseYdk(text)).toEqual(deck);
    expect(readYdkMeta(text)).toEqual({
      name: "Blitzclique",
      source: "https://ygoprodeck.com/deck/x-1",
      event: "YCS, 1st",
    });
  });

  it("has no metadata for a plain .ydk", () => {
    expect(readYdkMeta("#created by EDOPro\n#main\n1\n")).toEqual({});
  });
});

describe("parseYdke", () => {
  it("reads main, extra and side from a ydke:// link", () => {
    expect(
      parseYdke(`ydke://${b64([10, 20])}!${b64([30])}!${b64([])}!`),
    ).toEqual({ main: [10, 20], extra: [30], side: [] });
  });

  it("rejects anything else", () => {
    expect(() => parseYdke("https://example.com")).toThrow(/ydke/);
  });
});

describe("YGOProDeck deck pages", () => {
  it("recognises deck URLs", () => {
    expect(
      isYgoprodeckDeckUrl("https://ygoprodeck.com/deck/blitzclique-736703"),
    ).toBe(true);
    expect(isYgoprodeckDeckUrl("https://ygoprodeck.com/card/?search=1")).toBe(
      false,
    );
    expect(isYgoprodeckDeckUrl("https://evil.example/deck/x-1")).toBe(false);
  });

  it("reads the deck list and name from the page", () => {
    const html = `<script>var maindeckjs = '["1","1","2"]';
      var extradeckjs = '["3"]';
      var sidedeckjs = '[]';
      var deckname = "Blitzclique";</script>`;
    expect(parseYgoprodeckPage(html)).toEqual({
      name: "Blitzclique",
      deck: { main: [1, 1, 2], extra: [3], side: [] },
    });
  });

  it("fails clearly when the page has no deck", () => {
    expect(() => parseYgoprodeckPage("<html></html>")).toThrow(/deck list/);
  });
});

describe("validateDeck", () => {
  const known = new Set([1, 2, 3]);
  it("lists unknown cards and size problems", () => {
    const report = validateDeck(
      { main: [1, 2, 9], extra: [3], side: [] },
      (code) => known.has(code),
    );
    expect(report.unknown).toEqual([9]);
    expect(report.problems).toEqual([
      "Main Deck has 3 cards (needs 40 to 60)",
      "1 card not in the card database",
    ]);
  });

  it("accepts a legal-size deck of known cards", () => {
    const main = Array.from({ length: 40 }, () => 1);
    expect(
      validateDeck({ main, extra: [], side: [] }, (code) => known.has(code))
        .problems,
    ).toEqual([]);
  });
});
