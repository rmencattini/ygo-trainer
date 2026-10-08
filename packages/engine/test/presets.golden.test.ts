// Every preset deck must load: all cards known, and a duel starts without script errors.
import { passiveResponse } from "@ygo/ai";
import { loadCatalog } from "@ygo/cards/node";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DuelSession, validateDeck } from "../src";
import { createNodeEngine, loadYdk } from "../src/node";

const DATA = join(__dirname, "..", "..", "..", "data");
const PRESETS = join(DATA, "decks", "presets");
const files = readdirSync(PRESETS).filter((f) => f.endsWith(".ydk"));
const catalog = loadCatalog({
  cdb: join(DATA, "cdb", "cards.cdb"),
  localeDir: join(DATA, "missing"),
});
const texts = {
  name: (c: number) => `#${c}`,
  cardString: () => undefined,
  system: () => undefined,
};

describe("preset decks", () => {
  it("has 4 to 6 presets", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files.length).toBeLessThanOrEqual(6);
  });

  it.each(files)(
    "%s: every card is in the card DB and the size is legal",
    (file) => {
      const deck = loadYdk(join(PRESETS, file));
      expect(
        validateDeck(deck, (code) => catalog.get(code) !== null).problems,
      ).toEqual([]);
    },
  );

  it.each(files)(
    "%s: a duel against itself starts and plays a turn with no script errors",
    async (file) => {
      const deck = loadYdk(join(PRESETS, file));
      const engine = await createNodeEngine({ dataDir: DATA });
      const duel = engine.startDuel({
        seed: [5n, 6n, 7n, 8n],
        decks: [deck, deck],
      });
      const session = new DuelSession(duel, {
        human: 0,
        opponent: passiveResponse,
        texts,
      });
      // You pass too: end turn 1, the opponent passes turn 2.
      for (
        let step = 0;
        step < 200 && session.board.turn < 3 && session.prompt;
        step++
      ) {
        session.answer(passiveResponse(session.prompt));
      }
      expect(session.board.turn).toBeGreaterThanOrEqual(3);
      expect(duel.errors).toEqual([]);
    },
  );
});
