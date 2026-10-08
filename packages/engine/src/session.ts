import {
  OcgHintType,
  OcgLocation,
  OcgMessageType,
  OcgResponseType,
  type OcgMessage,
  type OcgPhase,
  type OcgResponse,
} from "ocgcore-wasm";
import type { CardInfo, Duel } from "./duel";
import { logLine, type TextSource } from "./english";

/** The core opens chain windows even when you have nothing to chain; EDOPro passes those for you. */
function isEmptyChainWindow(prompt: OcgMessage): boolean {
  return (
    prompt.type === OcgMessageType.SELECT_CHAIN &&
    prompt.selects.length === 0 &&
    !prompt.forced
  );
}

/** Answers a prompt for a non-human player. */
export type Responder = (prompt: OcgMessage) => OcgResponse;

export interface PlayerBoard {
  lp: number;
  deck: number;
  hand: CardInfo[];
  /** 7 slots: 5 Main Monster Zones, then the 2 Extra Monster Zones. */
  monsters: CardInfo[];
  /** 5 Spell/Trap Zones, Field Zone, then the 2 Pendulum Zones. */
  spells: CardInfo[];
  grave: CardInfo[];
  banished: CardInfo[];
  extra: CardInfo[];
}

export interface Board {
  players: [PlayerBoard, PlayerBoard];
  turn: number;
  turnPlayer: number;
  phase: OcgPhase | 0;
}

export interface SessionOptions {
  /** The player you control. The other one answers through `opponent`. */
  human: 0 | 1;
  opponent: Responder;
  texts: TextSource;
}

/** Runs a duel for one human player: the opponent answers by itself, you answer `prompt`. */
export class DuelSession {
  prompt: OcgMessage | null = null;
  ended = false;
  /** The last "select …" hint for you (a system string id or card string), cleared on answer. */
  hint: bigint | null = null;
  winner: number | null = null;
  /** The duel log in plain English. */
  readonly lines: string[] = [];
  board: Board;
  private seen = 0;
  private turn = 0;
  private turnPlayer = 0;
  private phase: OcgPhase | 0 = 0;

  constructor(
    readonly duel: Duel,
    private readonly options: SessionOptions,
  ) {
    this.board = this.readBoard();
    this.run();
  }

  get human(): 0 | 1 {
    return this.options.human;
  }

  answer(response: OcgResponse): void {
    if (!this.prompt) throw new Error("no prompt to answer");
    this.prompt = null;
    this.hint = null;
    this.duel.respond(response);
    this.run();
  }

  private run(): void {
    for (;;) {
      const step = this.duel.next();
      this.digest();
      // The core sends WIN but keeps going; EDOPro's server is what stops the duel.
      if (step.status === "ended" || this.winner !== null) {
        this.ended = true;
        break;
      }
      // Retry means the last answer was invalid; ask the same player again.
      if (step.prompt.type === OcgMessageType.RETRY) continue;
      if (
        step.player === this.options.human &&
        !isEmptyChainWindow(step.prompt)
      ) {
        this.prompt = step.prompt;
        break;
      }
      if (step.player === this.options.human) {
        this.duel.respond({ type: OcgResponseType.SELECT_CHAIN, index: null });
        continue;
      }
      this.duel.respond(this.options.opponent(step.prompt));
    }
    this.board = this.readBoard();
  }

  private digest(): void {
    const codeAt = (loc: {
      controller: 0 | 1;
      location: OcgLocation;
      sequence: number;
    }) =>
      this.duel.cards(loc.controller, loc.location)[loc.sequence]?.code ?? 0;
    for (; this.seen < this.duel.log.length; this.seen++) {
      const entry = this.duel.log[this.seen];
      if (entry.kind !== "message") continue;
      const message = entry.message;
      if (message.type === OcgMessageType.NEW_TURN) {
        this.turn++;
        this.turnPlayer = message.player;
      } else if (message.type === OcgMessageType.NEW_PHASE) {
        this.phase = message.phase;
      } else if (
        message.type === OcgMessageType.HINT &&
        message.hint_type === OcgHintType.SELECTMSG &&
        message.player === this.options.human
      ) {
        this.hint = message.hint;
      } else if (message.type === OcgMessageType.WIN) {
        this.winner = message.player;
        this.lines.push(
          logLine(message, this.options.texts, this.options.human)!,
        );
        this.seen = this.duel.log.length;
        return;
      }
      const line = logLine(
        message,
        this.options.texts,
        this.options.human,
        codeAt,
      );
      if (line) this.lines.push(line);
    }
  }

  private readBoard(): Board {
    const lp = this.duel.lp();
    const decks = this.duel.deckCounts();
    const side = (p: 0 | 1): PlayerBoard => ({
      lp: lp[p],
      deck: decks[p],
      hand: this.duel.cards(p, OcgLocation.HAND),
      monsters: this.duel.cards(p, OcgLocation.MZONE),
      spells: this.duel.cards(p, OcgLocation.SZONE),
      grave: this.duel.cards(p, OcgLocation.GRAVE),
      banished: this.duel.cards(p, OcgLocation.REMOVED),
      extra: this.duel.cards(p, OcgLocation.EXTRA),
    });
    return {
      players: [side(0), side(1)],
      turn: this.turn,
      turnPlayer: this.turnPlayer,
      phase: this.phase,
    };
  }
}
