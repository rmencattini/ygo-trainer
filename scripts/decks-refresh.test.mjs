import { describe, expect, it } from "vitest";
import { pickPresets, slugify } from "./decks-refresh.mjs";

const deck = (deckNum, deck_name, tournamentPlacement) => ({
  deckNum,
  deck_name,
  tournamentPlacement,
  tournamentName: `Event ${deckNum}`,
  pretty_url: `${slugify(deck_name)}-${deckNum}`,
  main_deck: JSON.stringify(["1", "2"]),
  extra_deck: JSON.stringify(["3"]),
  side_deck: null,
});

describe("pickPresets", () => {
  const lists = [
    deck(10, "Elfnote", "Top 8"),
    deck(9, "Blitzclique", "Top 32"),
    deck(8, "Elfnote", "Winner"),
    deck(7, "Blitzclique", "Winner"),
    deck(6, "Elfnote", "Top 4"),
    deck(5, "Sky Striker", "Top 4"),
  ];

  it("keeps the most played archetypes, most played first", () => {
    expect(pickPresets(lists, 2).map((p) => p.name)).toEqual([
      "Elfnote",
      "Blitzclique",
    ]);
  });

  it("takes each archetype's best placement, newest first on ties", () => {
    const [elfnote, blitz] = pickPresets(lists, 2);
    expect(elfnote.event).toBe("Event 8, Winner");
    expect(blitz.source).toBe("https://ygoprodeck.com/deck/blitzclique-7");
    expect(elfnote.deck).toEqual({ main: [1, 2], extra: [3], side: [] });
  });
});

describe("slugify", () => {
  it("makes file-safe names", () => {
    expect(slugify("Azamina Mitsurugi Light & Darkness")).toBe(
      "azamina-mitsurugi-light-darkness",
    );
  });
});
