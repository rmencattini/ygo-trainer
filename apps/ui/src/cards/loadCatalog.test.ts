import { describe, expect, it, vi } from "vitest";
import { fetchCatalog } from "./loadCatalog";

const en = [
  {
    code: 1,
    alias: 0,
    name: "One",
    desc: "",
    type: 0x11,
    level: 4,
    attribute: 1,
    race: 1,
    atk: 0,
    def: 0,
  },
];

function fakeFetch(files: Record<string, unknown>) {
  return vi.fn(async (url: string) =>
    url in files
      ? new Response(JSON.stringify(files[url]))
      : new Response("", { status: 404 }),
  );
}

describe("fetchCatalog", () => {
  it("loads English plus each language listed in the index", async () => {
    const fetch = fakeFetch({
      "/cards/index.json": { langs: ["fr"] },
      "/cards/en.json": en,
      "/cards/fr.json": { "1": { name: "Un", desc: "" } },
    });
    const catalog = await fetchCatalog("/cards", fetch);
    expect(catalog.languages()).toEqual(["en", "fr"]);
    expect(catalog.get(1, "fr")?.name).toBe("Un");
  });

  it("fails with a hint when the card data was never exported", async () => {
    await expect(fetchCatalog("/cards", fakeFetch({}))).rejects.toThrow(
      /npm run cards:export/,
    );
  });
});
