// Golden duel (M1 acceptance): fixed seed + fixed decks + recorded responses
// must end with the summoned monster face-up on the field.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createNodeEngine, loadYdk } from "../src/node";
import {
  CardLocation,
  CardPosition,
  MessageType,
  type Duel,
  type DuelOptions,
} from "../src";

const DATA = join(__dirname, "..", "..", "..", "data");
const deck = loadYdk(join(DATA, "decks", "m1-vanilla.ydk"));

function waitFor(duel: Duel, type: MessageType) {
  const step = duel.next();
  expect(step.status).toBe("awaiting");
  if (step.status !== "awaiting") throw new Error("duel ended");
  expect(step.prompt.type).toBe(type);
  return step.prompt;
}

describe("golden duel: Normal Summon", () => {
  it("summons a level 4 monster from hand to the field", async () => {
    const engine = await createNodeEngine({ dataDir: DATA });
    const duel = engine.startDuel({
      seed: [1n, 2n, 3n, 4n],
      decks: [deck, deck],
    });

    const idle = waitFor(duel, MessageType.SELECT_IDLECMD);
    expect(idle.type === MessageType.SELECT_IDLECMD && idle.player).toBe(0);
    if (idle.type !== MessageType.SELECT_IDLECMD) return;
    expect(idle.summons.length).toBeGreaterThan(0);
    const summoned = idle.summons[0].code;

    duel.normalSummon(0);
    // Some board states ask for a zone; pick the first free one.
    let step = duel.next();
    if (
      step.status === "awaiting" &&
      step.prompt.type === MessageType.SELECT_PLACE
    ) {
      duel.selectFirstPlace(step.prompt);
      step = duel.next();
    }
    // Opponent may get a chain window; the summoned monster stays either way.
    expect(step.status).toBe("awaiting");

    const field = duel.cards(0, CardLocation.MZONE).filter((c) => c !== null);
    expect(field).toHaveLength(1);
    expect(field[0]).toMatchObject({
      code: summoned,
      position: CardPosition.FACEUP_ATTACK,
    });
    expect(duel.cards(0, CardLocation.HAND)).toHaveLength(4);

    // The log keeps every message and response for replay and the coach.
    expect(duel.log.some((e) => e.kind === "response")).toBe(true);
    duel.destroy();
  });

  describe("opening hand", () => {
    async function openingHand(options: Partial<DuelOptions>) {
      const engine = await createNodeEngine({ dataDir: DATA });
      const duel = engine.startDuel({
        seed: [9n, 9n, 9n, 9n],
        decks: [deck, deck],
        ...options,
      });
      duel.next();
      const codes = duel.cards(0, CardLocation.HAND).map((c) => c?.code);
      duel.destroy();
      return codes;
    }

    it("is the same for the same seed", async () => {
      const first = await openingHand({});
      expect(first).toHaveLength(5);
      expect(await openingHand({})).toEqual(first);
    });

    it("changes with the seed", async () => {
      expect(await openingHand({ seed: [1n, 1n, 1n, 1n] })).not.toEqual(
        await openingHand({}),
      );
    });

    it("is the top of the deck list when shuffle is off", async () => {
      expect(await openingHand({ shuffle: false })).toEqual(
        deck.main.slice(0, 5),
      );
    });
  });
});
