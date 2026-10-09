// Golden duels (M5 acceptance): the AI opponent fires handtraps by rule and plays a plain turn by heuristic.
import { loadCatalog } from "@ygo/cards/node";
import {
  DuelSession,
  MessageType,
  ResponseType,
  SelectIdleCMDAction,
  type Deck,
  type Message,
  type Response,
} from "@ygo/engine";
import { createNodeEngine } from "@ygo/engine/node";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createOpponent, passiveResponse } from "../src";

const DATA = join(__dirname, "..", "..", "..", "data");
const catalog = loadCatalog({
  cdb: join(DATA, "cdb", "cards.cdb"),
  localeDir: join(DATA, "missing"),
});
const texts = {
  name: (code: number) => catalog.get(code)?.name ?? `Card ${code}`,
  cardString: () => undefined,
  system: () => undefined,
};
const alias = (code: number) => catalog.get(code)?.alias || code;

const ASH_ALT_ART = 14558128;
const MAXX_C = 23434538;
const REINFORCEMENT_OF_THE_ARMY = 32807846;
const MARAUDING_CAPTAIN = 2460565;
const CELTIC_GUARDIAN = 91152256;
const MONSTER_REBORN = 83764718;
const DROLL = 94145021;
const FOOLISH_BURIAL = 81439173;
const GHOST_BELLE = 73642296;
const GHOST_OGRE = 59438930;
const EFFECT_VEILER = 97268402;
const RESCUE_RABBIT = 85138716;
const NIBIRU = 27204311;
const PRIMAL_BEING_TOKEN = 27204312;
const MULCHARMY_FUWALOS = 42141493;
const MULCHARMY_PURULIA = 84192580;

/** Passcodes of the cards in a zone list, empty slots left out. */
const codes = (cards: ({ code?: number } | null)[]) =>
  cards.filter(Boolean).map((c) => c!.code);
const LEVEL_4_VANILLA = 69247929; // Gene-Warped Warwolf

/** A 40-card deck in draw order: `top` first, then `fill`. */
const deck = (top: number[], fill: number): Deck => ({
  main: [...top, ...Array(40 - top.length).fill(fill)],
  extra: [],
  side: [],
});

async function play(decks: [Deck, Deck], human: 0 | 1) {
  const engine = await createNodeEngine({ dataDir: DATA });
  const duel = engine.startDuel({
    seed: [1n, 2n, 3n, 4n],
    decks,
    shuffle: false,
  });
  const session = new DuelSession(duel, {
    human,
    opponent: createOpponent({ alias }),
    texts,
  });
  return { duel, session };
}

const chainings = (session: DuelSession) =>
  session.duel.log.flatMap((e) =>
    e.kind === "message" && e.message.type === MessageType.CHAINING
      ? [{ code: e.message.code, controller: e.message.controller }]
      : [],
  );

/** Index in the log of the first message matching `test`. */
const firstIndex = (session: DuelSession, test: (m: Message) => boolean) =>
  session.duel.log.findIndex((e) => e.kind === "message" && test(e.message));

function activate(session: DuelSession, code: number) {
  const idle = session.prompt;
  if (idle?.type !== MessageType.SELECT_IDLECMD) throw new Error("not idle");
  const index = idle.activates.findIndex((c) => c.code === code);
  expect(index).toBeGreaterThanOrEqual(0);
  session.answer({
    type: ResponseType.SELECT_IDLECMD,
    action: SelectIdleCMDAction.SELECT_ACTIVATE,
    index,
  });
}

function normalSummon(session: DuelSession, code: number) {
  const idle = session.prompt;
  if (idle?.type !== MessageType.SELECT_IDLECMD) throw new Error("not idle");
  const index = idle.summons.findIndex((c) => c.code === code);
  expect(index).toBeGreaterThanOrEqual(0);
  session.answer({
    type: ResponseType.SELECT_IDLECMD,
    action: SelectIdleCMDAction.SELECT_SUMMON,
    index,
  });
}

/** Answers your prompts until you are back in the Main Phase: yes to optional effects, first choice otherwise. */
function settle(session: DuelSession) {
  for (let guard = 0; guard < 30; guard++) {
    const prompt = session.prompt;
    if (!prompt || prompt.type === MessageType.SELECT_IDLECMD) return;
    let response: Response;
    if (prompt.type === MessageType.SELECT_EFFECTYN)
      response = { type: ResponseType.SELECT_EFFECTYN, yes: true };
    else if (prompt.type === MessageType.SELECT_YESNO)
      response = { type: ResponseType.SELECT_YESNO, yes: true };
    else if (prompt.type === MessageType.SELECT_CHAIN)
      response = {
        type: ResponseType.SELECT_CHAIN,
        index: prompt.selects.length ? 0 : null,
      };
    else response = passiveResponse(prompt);
    session.answer(response);
  }
  throw new Error("prompts never settled");
}

describe("AI opponent: handtrap rules", () => {
  it("fires Ash Blossom (alternate art) on your first search", async () => {
    const { session, duel } = await play(
      [
        deck([REINFORCEMENT_OF_THE_ARMY, MARAUDING_CAPTAIN], CELTIC_GUARDIAN),
        deck([], ASH_ALT_ART),
      ],
      0,
    );

    activate(session, REINFORCEMENT_OF_THE_ARMY);
    settle(session);

    expect(chainings(session)).toEqual([
      { code: REINFORCEMENT_OF_THE_ARMY, controller: 0 },
      { code: ASH_ALT_ART, controller: 1 },
    ]);
    const [me, ai] = session.board.players;
    expect(me.hand).toHaveLength(4); // no Warrior added
    expect(me.grave.map((c) => c?.code)).toEqual([REINFORCEMENT_OF_THE_ARMY]);
    expect(ai.hand).toHaveLength(4);
    expect(ai.grave.map((c) => c?.code)).toEqual([ASH_ALT_ART]);
    expect(duel.errors).toEqual([]);
  });

  it('waits for your first Special Summon before Maxx "C"', async () => {
    const { session, duel } = await play(
      [
        deck([MARAUDING_CAPTAIN, REINFORCEMENT_OF_THE_ARMY], CELTIC_GUARDIAN),
        deck([], MAXX_C),
      ],
      0,
    );

    normalSummon(session, MARAUDING_CAPTAIN);
    settle(session);

    const special = firstIndex(
      session,
      (m) => m.type === MessageType.SPSUMMONING && m.controller === 0,
    );
    const maxx = firstIndex(
      session,
      (m) => m.type === MessageType.CHAINING && m.code === MAXX_C,
    );
    expect(special).toBeGreaterThan(0);
    expect(maxx).toBeGreaterThan(special);
    expect(
      session.board.players[0].monsters.filter(Boolean).map((c) => c?.code),
    ).toEqual(expect.arrayContaining([MARAUDING_CAPTAIN, CELTIC_GUARDIAN]));
    expect(session.board.players[1].grave.map((c) => c?.code)).toEqual([
      MAXX_C,
    ]);
    expect(duel.errors).toEqual([]);
  });

  it("fires Droll & Lock Bird once your search has resolved", async () => {
    const { session, duel } = await play(
      [deck([REINFORCEMENT_OF_THE_ARMY], CELTIC_GUARDIAN), deck([], DROLL)],
      0,
    );

    activate(session, REINFORCEMENT_OF_THE_ARMY);
    settle(session);

    const searched = firstIndex(
      session,
      (m) => m.type === MessageType.CHAIN_SOLVED,
    );
    const droll = firstIndex(
      session,
      (m) => m.type === MessageType.CHAINING && m.code === DROLL,
    );
    expect(searched).toBeGreaterThan(0);
    expect(droll).toBeGreaterThan(searched);
    expect(session.board.players[0].hand).toHaveLength(5); // the search went through
    expect(codes(session.board.players[1].grave)).toEqual([DROLL]);
    expect(duel.errors).toEqual([]);
  });

  it("fires Ghost Belle on a card that Special Summons from the GY", async () => {
    const { session, duel } = await play(
      [
        deck([FOOLISH_BURIAL, MONSTER_REBORN], CELTIC_GUARDIAN),
        deck([], GHOST_BELLE),
      ],
      0,
    );

    activate(session, FOOLISH_BURIAL);
    settle(session);
    expect(chainings(session)).toHaveLength(1); // sending from the Deck is fine
    activate(session, MONSTER_REBORN);
    settle(session);

    expect(chainings(session)).toEqual([
      { code: FOOLISH_BURIAL, controller: 0 },
      { code: MONSTER_REBORN, controller: 0 },
      { code: GHOST_BELLE, controller: 1 },
    ]);
    expect(codes(session.board.players[0].monsters)).toEqual([]);
    expect(codes(session.board.players[1].grave)).toEqual([GHOST_BELLE]);
    expect(duel.errors).toEqual([]);
  });

  it("fires Ghost Ogre on your monster's effect and destroys it", async () => {
    const { session, duel } = await play(
      [deck([MARAUDING_CAPTAIN], CELTIC_GUARDIAN), deck([], GHOST_OGRE)],
      0,
    );

    normalSummon(session, MARAUDING_CAPTAIN);
    settle(session);

    expect(chainings(session)).toEqual([
      { code: MARAUDING_CAPTAIN, controller: 0 },
      { code: GHOST_OGRE, controller: 1 },
    ]);
    expect(codes(session.board.players[0].grave)).toEqual([MARAUDING_CAPTAIN]);
    expect(codes(session.board.players[1].grave)).toEqual([GHOST_OGRE]);
    expect(duel.errors).toEqual([]);
  });

  it("fires Effect Veiler on your monster and stops its effect", async () => {
    const { session, duel } = await play(
      [deck([MARAUDING_CAPTAIN], CELTIC_GUARDIAN), deck([], EFFECT_VEILER)],
      0,
    );

    normalSummon(session, MARAUDING_CAPTAIN);
    settle(session);

    expect(chainings(session)).toContainEqual({
      code: EFFECT_VEILER,
      controller: 1,
    });
    expect(codes(session.board.players[0].monsters)).toEqual([
      MARAUDING_CAPTAIN,
    ]); // no Special Summon from the Captain
    expect(codes(session.board.players[1].grave)).toEqual([EFFECT_VEILER]);
    expect(duel.errors).toEqual([]);
  });

  it("fires Nibiru after your fifth summon", async () => {
    const { session, duel } = await play(
      [
        deck(
          [
            RESCUE_RABBIT,
            FOOLISH_BURIAL,
            FOOLISH_BURIAL,
            MONSTER_REBORN,
            MONSTER_REBORN,
          ],
          CELTIC_GUARDIAN,
        ),
        deck([], NIBIRU),
      ],
      0,
    );
    const nibiru = () =>
      chainings(session).filter((c) => c.code === NIBIRU).length;

    normalSummon(session, RESCUE_RABBIT); // summon 1
    settle(session);
    activate(session, RESCUE_RABBIT); // summons 2 and 3
    settle(session);
    activate(session, FOOLISH_BURIAL);
    settle(session);
    activate(session, FOOLISH_BURIAL);
    settle(session);
    activate(session, MONSTER_REBORN); // summon 4
    settle(session);
    expect(nibiru()).toBe(0);
    activate(session, MONSTER_REBORN); // summon 5
    settle(session);

    expect(nibiru()).toBe(1);
    expect(codes(session.board.players[0].monsters)).toEqual([
      PRIMAL_BEING_TOKEN,
    ]);
    expect(codes(session.board.players[1].monsters)).toEqual([NIBIRU]);
    expect(duel.errors).toEqual([]);
  });

  it.each([
    ["Mulcharmy Fuwalos", MULCHARMY_FUWALOS],
    ["Mulcharmy Purulia", MULCHARMY_PURULIA],
  ])("fires %s on your turn", async (_name, code) => {
    const { session, duel } = await play(
      [deck([], CELTIC_GUARDIAN), deck([], code)],
      0,
    );

    normalSummon(session, CELTIC_GUARDIAN);
    settle(session);

    expect(chainings(session)).toEqual([{ code, controller: 1 }]);
    expect(codes(session.board.players[1].grave)).toEqual([code]);
    expect(duel.errors).toEqual([]);
  });
});

describe("AI opponent: its own turn", () => {
  it("passes cleanly when it has no plays", async () => {
    const { session, duel } = await play(
      [deck([], MONSTER_REBORN), deck([], LEVEL_4_VANILLA)],
      1,
    );

    expect(session.prompt?.type).toBe(MessageType.SELECT_IDLECMD);
    expect(session.board.turn).toBe(2);
    const ai = session.board.players[0];
    expect(ai.hand).toHaveLength(5);
    expect(ai.monsters.every((c) => c === null)).toBe(true);
    expect(ai.spells.every((c) => c === null)).toBe(true);
    expect(duel.errors).toEqual([]);
  });

  it("Normal Summons a monster, then ends its turn", async () => {
    const { session } = await play(
      [deck([], LEVEL_4_VANILLA), deck([], LEVEL_4_VANILLA)],
      1,
    );

    expect(session.board.turn).toBe(2);
    const ai = session.board.players[0];
    expect(ai.monsters.filter(Boolean).map((c) => c?.code)).toEqual([
      LEVEL_4_VANILLA,
    ]);
    expect(ai.hand).toHaveLength(4);
  });

  it("keeps its handtraps in hand instead of summoning them", async () => {
    const { session } = await play(
      [deck([], ASH_ALT_ART), deck([], LEVEL_4_VANILLA)],
      1,
    );

    expect(session.board.turn).toBe(2);
    expect(session.board.players[0].hand).toHaveLength(5);
    expect(session.board.players[0].monsters.every((c) => c === null)).toBe(
      true,
    );
  });
});
