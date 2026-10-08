import createCore, {
  OcgDuelMode,
  OcgLocation,
  OcgProcessResult,
  OcgQueryFlags,
  OcgResponseType,
  SelectIdleCMDAction,
  type OcgCardData,
  type OcgCardQueryInfo,
  type OcgCoreSync,
  type OcgDuelHandle,
  type OcgMessage,
  type OcgMessageSelectPlace,
  type OcgResponse,
} from "ocgcore-wasm";
import { mixSeed, seededShuffle } from "./shuffle";
import type { Deck } from "./ydk";

export interface EngineSources {
  /** Card record by passcode, or null if unknown. */
  readCard(code: number): OcgCardData | null;
  /** Lua script by file name (`c12345.lua`, `utility.lua`…), or null if missing. */
  readScript(name: string): string | null;
  /** The ocgcore sync wasm binary. Omit in Node to let the package load its own. */
  wasmBinary?: ArrayBuffer;
}

export interface DuelOptions {
  seed: [bigint, bigint, bigint, bigint];
  /** decks[0] goes first. */
  decks: [Deck, Deck];
  startingLP?: number;
  /** Shuffle each main deck from the seed (default). Off keeps list order, top card first. */
  shuffle?: boolean;
}

export type LogEntry =
  | { kind: "message"; message: OcgMessage }
  | { kind: "response"; response: OcgResponse };

export type Step =
  | { status: "awaiting"; player: number; prompt: OcgMessage }
  | { status: "ended" };

export type CardInfo = Partial<OcgCardQueryInfo> | null;

// ocgcore-wasm 0.1.2 misparses query replies that include TYPE or LEVEL, so leave them out.
const QUERY_FLAGS =
  OcgQueryFlags.CODE |
  OcgQueryFlags.POSITION |
  OcgQueryFlags.ATTACK |
  OcgQueryFlags.DEFENSE;

// Scripts the EDOPro client loads by hand before a duel starts.
const BOOT_SCRIPTS = ["constant.lua", "utility.lua"];

export class Duel {
  readonly log: LogEntry[] = [];
  private ended = false;

  constructor(
    private readonly core: OcgCoreSync,
    private readonly handle: OcgDuelHandle,
  ) {}

  /** Runs the engine until a player must answer or the duel ends. */
  next(): Step {
    if (this.ended) return { status: "ended" };
    for (;;) {
      const status = this.core.duelProcess(this.handle);
      const messages = this.core.duelGetMessage(this.handle);
      for (const message of messages)
        this.log.push({ kind: "message", message });
      if (status === OcgProcessResult.END) {
        this.ended = true;
        return { status: "ended" };
      }
      if (status === OcgProcessResult.WAITING) {
        const prompt = messages[messages.length - 1];
        const player = "player" in prompt ? prompt.player : 0;
        return { status: "awaiting", player, prompt };
      }
    }
  }

  respond(response: OcgResponse): void {
    this.log.push({ kind: "response", response });
    this.core.duelSetResponse(this.handle, response);
  }

  /** Answers SELECT_IDLECMD with "Normal Summon summons[index]". */
  normalSummon(index: number): void {
    this.respond({
      type: OcgResponseType.SELECT_IDLECMD,
      action: SelectIdleCMDAction.SELECT_SUMMON,
      index,
    });
  }

  /** Answers SELECT_PLACE with the lowest free zones offered. */
  selectFirstPlace(prompt: OcgMessageSelectPlace): void {
    const places = [];
    // field_mask marks blocked zones; bits 0-7 MZONE, 8-15 SZONE, +16 for the opponent.
    for (let bit = 0; bit < 32 && places.length < prompt.count; bit++) {
      if (prompt.field_mask & (1 << bit)) continue;
      const opponent = bit >= 16;
      const local = bit % 16;
      places.push({
        player: opponent ? 1 - prompt.player : prompt.player,
        location: local < 8 ? OcgLocation.MZONE : OcgLocation.SZONE,
        sequence: local % 8,
      });
    }
    this.respond({ type: OcgResponseType.SELECT_PLACE, places });
  }

  /** Cards in one location of one player. Empty zones come back as null. */
  cards(controller: 0 | 1, location: OcgLocation): CardInfo[] {
    return this.core.duelQueryLocation(this.handle, {
      flags: QUERY_FLAGS as OcgQueryFlags,
      controller,
      location,
    });
  }

  destroy(): void {
    this.core.destroyDuel(this.handle);
  }
}

export class Engine {
  private constructor(
    private readonly core: OcgCoreSync,
    private readonly sources: EngineSources,
  ) {}

  static async create(sources: EngineSources): Promise<Engine> {
    const core = await createCore({
      sync: true,
      wasmBinary: sources.wasmBinary,
    });
    return new Engine(core, sources);
  }

  startDuel(options: DuelOptions): Duel {
    const team = {
      startingLP: options.startingLP ?? 8000,
      startingDrawCount: 5,
      drawCountPerTurn: 1,
    };
    const handle = this.core.createDuel({
      flags: OcgDuelMode.MODE_MR5,
      seed: options.seed,
      team1: team,
      team2: team,
      cardReader: (code) => this.sources.readCard(code),
      scriptReader: (name) => this.sources.readScript(name),
      errorHandler: (type, text) => {
        throw new Error(`ocgcore error ${type}: ${text}`);
      },
    });
    if (!handle) throw new Error("ocgcore could not create the duel");

    for (const name of BOOT_SCRIPTS) {
      const content = this.sources.readScript(name);
      if (!content || !this.core.loadScript(handle, name, content)) {
        throw new Error(`could not load ${name}`);
      }
    }

    options.decks.forEach((deck, team) => {
      const add = (code: number, location: OcgLocation) =>
        this.core.duelNewCard(handle, {
          team: team as 0 | 1,
          duelist: 0,
          code,
          controller: team as 0 | 1,
          location,
          sequence: 0,
          position: 0x8, // face-down defense, the engine fixes it per location
        });
      // The core does not shuffle on its own; the EDOPro server does it before adding cards.
      const main =
        options.shuffle === false
          ? deck.main
          : seededShuffle(deck.main, mixSeed(options.seed, team));
      // sequence 0 puts each card on top, so add in reverse to keep list order top-down.
      [...main].reverse().forEach((code) => add(code, OcgLocation.DECK));
      deck.extra.forEach((code) => add(code, OcgLocation.EXTRA));
    });

    this.core.startDuel(handle);
    return new Duel(this.core, handle);
  }
}
