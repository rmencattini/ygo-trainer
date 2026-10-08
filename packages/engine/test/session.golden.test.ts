// Golden duel through DuelSession: you vs a passive opponent, English log on top.
import { loadCatalog } from "@ygo/cards/node";
import { passiveResponse } from "@ygo/ai";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DuelSession,
  MessageType,
  Phase,
  SelectBattleCMDAction,
  SelectIdleCMDAction,
  ResponseType,
} from "../src";
import { createNodeEngine, loadYdk } from "../src/node";

const DATA = join(__dirname, "..", "..", "..", "data");
const deck = loadYdk(join(DATA, "decks", "m1-vanilla.ydk"));
const catalog = loadCatalog({
  cdb: join(DATA, "cdb", "cards.cdb"),
  localeDir: join(DATA, "missing"),
});
const texts = {
  name: (code: number) => catalog.get(code)?.name ?? `Card ${code}`,
  cardString: () => undefined,
  system: () => undefined,
};

async function newSession() {
  const engine = await createNodeEngine({ dataDir: DATA });
  const duel = engine.startDuel({
    seed: [1n, 2n, 3n, 4n],
    decks: [deck, deck],
  });
  return new DuelSession(duel, { human: 0, opponent: passiveResponse, texts });
}

describe("DuelSession", () => {
  it("stops at your first Main Phase with 5 cards and an empty field", async () => {
    const session = await newSession();
    expect(session.prompt?.type).toBe(MessageType.SELECT_IDLECMD);
    expect(session.board.players[0].hand).toHaveLength(5);
    expect(session.board.players[1].hand).toHaveLength(5);
    expect(session.board.players[0].monsters.every((c) => c === null)).toBe(
      true,
    );
    expect(session.board.players[0].lp).toBe(8000);
    expect(session.board.phase).toBe(Phase.MAIN1);
    expect(session.board.turnPlayer).toBe(0);
    expect(session.lines).toContain("Your turn");
  });

  it("Normal Summons, logs it in English and shows the monster", async () => {
    const session = await newSession();
    const idle = session.prompt;
    if (idle?.type !== MessageType.SELECT_IDLECMD)
      throw new Error("expected idle");
    const code = idle.summons[0].code;
    session.answer({
      type: ResponseType.SELECT_IDLECMD,
      action: SelectIdleCMDAction.SELECT_SUMMON,
      index: 0,
    });
    if (session.prompt?.type === MessageType.SELECT_PLACE) {
      session.answer(passiveResponse(session.prompt));
    }
    expect(session.board.players[0].monsters.filter(Boolean)).toMatchObject([
      { code },
    ]);
    expect(session.lines).toContain(
      `You Normal Summon ${catalog.get(code)?.name}`,
    );
    expect(session.prompt?.type).toBe(MessageType.SELECT_IDLECMD);
  });

  it("plays the passive opponent's turn and hands control back to you", async () => {
    const session = await newSession();
    session.answer({
      type: ResponseType.SELECT_IDLECMD,
      action: SelectIdleCMDAction.TO_EP,
      index: null,
    });
    expect(
      session.prompt && "player" in session.prompt && session.prompt.player,
    ).toBe(0);
    expect(session.board.turn).toBe(3);
    expect(session.board.players[1].hand).toHaveLength(6);
    expect(session.lines).toContain("Opponent's turn");
    expect(session.lines.filter((l) => l === "Your turn")).toHaveLength(2);
  });
});

describe("DuelSession: lethal damage", () => {
  it("ends the duel at 0 LP when an attack deals more than the opponent has left", async () => {
    const engine = await createNodeEngine({ dataDir: DATA });
    const duel = engine.startDuel({
      seed: [1n, 2n, 3n, 4n],
      decks: [deck, deck],
      startingLP: 1000,
    });
    const session = new DuelSession(duel, {
      human: 0,
      opponent: passiveResponse,
      texts,
    });

    // Turn 1: summon, end turn. Turn 3: go to battle and attack directly.
    session.answer({
      type: ResponseType.SELECT_IDLECMD,
      action: SelectIdleCMDAction.SELECT_SUMMON,
      index: 0,
    });
    for (let guard = 0; guard < 50 && !session.ended; guard++) {
      const prompt = session.prompt!;
      if (prompt.type === MessageType.SELECT_IDLECMD) {
        session.answer({
          type: ResponseType.SELECT_IDLECMD,
          action: prompt.to_bp
            ? SelectIdleCMDAction.TO_BP
            : SelectIdleCMDAction.TO_EP,
          index: null,
        });
      } else if (
        prompt.type === MessageType.SELECT_BATTLECMD &&
        prompt.attacks.length
      ) {
        session.answer({
          type: ResponseType.SELECT_BATTLECMD,
          action: SelectBattleCMDAction.SELECT_BATTLE,
          index: 0,
        });
      } else {
        session.answer(passiveResponse(prompt));
      }
    }

    expect(session.ended).toBe(true);
    expect(session.winner).toBe(0);
    expect(session.board.players[1].lp).toBe(0);
    expect(session.lines.filter((l) => l === "You win")).toHaveLength(1);
    expect(session.prompt).toBeNull();
  });
});
