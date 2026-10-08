import { describe, expect, it, vi } from "vitest";
import {
  fetchDeckLibrary,
  importDeck,
  loadImported,
  saveImported,
  type DeckEntry,
} from "./deckLibrary";

const ydk = (name: string, codes: number[]) =>
  `#created by x\n#name ${name}\n#main\n${codes.join("\n")}\n#extra\n!side\n`;
const files: Record<string, string> = {
  "/decks/index.json": JSON.stringify([
    { file: "presets/a.ydk", name: "Alpha", preset: true },
    { file: "test.ydk", name: "Test", preset: false },
  ]),
  "/decks/presets/a.ydk": ydk("Alpha", [1, 2]),
  "/decks/test.ydk": ydk("Test", [3]),
};
const fakeFetch = vi.fn(async (url: string) =>
  url in files ? new Response(files[url]) : new Response("", { status: 404 }),
);

describe("fetchDeckLibrary", () => {
  it("loads presets and test decks with their names", async () => {
    const library = await fetchDeckLibrary(fakeFetch);
    expect(library.map((d) => [d.id, d.name, d.kind])).toEqual([
      ["presets/a.ydk", "Alpha", "preset"],
      ["test.ydk", "Test", "test"],
    ]);
    expect(library[0].deck.main).toEqual([1, 2]);
  });
});

describe("importDeck", () => {
  it("reads .ydk text and keeps its #name", async () => {
    expect(await importDeck(ydk("Mine", [5]), "mine.ydk")).toMatchObject({
      name: "Mine",
      deck: { main: [5] },
    });
  });

  it("names a plain .ydk after its file", async () => {
    expect(
      await importDeck("#main\n5\n#extra\n!side\n", "Snake-Eye.ydk"),
    ).toMatchObject({ name: "Snake-Eye" });
  });

  it("reads ydke:// links", async () => {
    const part = btoa(
      String.fromCharCode(...new Uint8Array(new Uint32Array([7]).buffer)),
    );
    expect(await importDeck(`ydke://${part}!!!`)).toMatchObject({
      name: "Imported deck",
      deck: { main: [7] },
    });
  });

  it("downloads YGOProDeck deck pages", async () => {
    const page = vi.fn(
      async () =>
        `var maindeckjs = '["9"]'; var extradeckjs = '[]'; var sidedeckjs = '[]'; var deckname = "Elfnote";`,
    );
    const entry = await importDeck(
      "https://ygoprodeck.com/deck/elfnote-736322",
      undefined,
      page,
    );
    expect(page).toHaveBeenCalledWith(
      "https://ygoprodeck.com/deck/elfnote-736322",
    );
    expect(entry).toMatchObject({
      name: "Elfnote",
      source: "https://ygoprodeck.com/deck/elfnote-736322",
      deck: { main: [9] },
    });
  });

  it("explains what it accepts when the input is something else", async () => {
    await expect(importDeck("hello")).rejects.toThrow(
      /\.ydk file, a ydke:\/\/ link or a YGOProDeck deck URL/,
    );
  });
});

describe("imported deck storage", () => {
  const entry: DeckEntry = {
    id: "imported:1",
    name: "Mine",
    kind: "imported",
    deck: { main: [1], extra: [], side: [] },
  };

  it("saves and loads imported decks", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    saveImported(storage, [entry]);
    expect(loadImported(storage)).toEqual([entry]);
  });

  it("returns nothing when storage is blocked", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadImported(storage)).toEqual([]);
    expect(() => saveImported(storage, [entry])).not.toThrow();
  });
});
