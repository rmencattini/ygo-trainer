// The AI opponent: fires handtraps by rule on your turn, plays a plain turn by heuristic on its own.
import {
  OcgMessageType,
  OcgResponseType,
  SelectBattleCMDAction,
  SelectIdleCMDAction,
  type Duel,
  type Message,
  type OcgMessageSelectIdlecmd,
  type Responder,
  type Response,
} from "@ygo/engine";
import rules from "./handtraps.json";
import { passiveResponse } from "./passive";

/**
 * When a handtrap goes off:
 * - `first-chance`: the first time the engine lets the AI activate it on your turn.
 * - `after-special-summon`: the first chance after you Special Summon this turn.
 */
export type HandtrapWhen = "first-chance" | "after-special-summon";

export interface HandtrapRule {
  code: number;
  name: string;
  when: HandtrapWhen;
}

export const HANDTRAP_RULES = rules as HandtrapRule[];

export interface OpponentOptions {
  rules?: HandtrapRule[];
  /** The original passcode of an alternate artwork (the card itself if none). */
  alias?: (code: number) => number;
}

/** Idle actions the AI takes in one turn before it stops, in case an effect loops. */
const MAX_ACTIONS = 20;

/** Who owns the current turn, and the messages sent since it began. */
function currentTurn(duel: Duel): { turnPlayer: number; messages: Message[] } {
  const messages: Message[] = [];
  for (let i = duel.log.length - 1; i >= 0; i--) {
    const entry = duel.log[i];
    if (entry.kind !== "message") continue;
    if (entry.message.type === OcgMessageType.NEW_TURN)
      return { turnPlayer: entry.message.player, messages: messages.reverse() };
    messages.push(entry.message);
  }
  return { turnPlayer: 0, messages: messages.reverse() };
}

/** The engine rejected the AI's last answer and is asking again. */
function isRetry(messages: Message[]): boolean {
  return messages.at(-2)?.type === OcgMessageType.RETRY;
}

function idleAction(
  prompt: OcgMessageSelectIdlecmd,
  keep: (code: number) => boolean,
): Response | null {
  const choices: [SelectIdleCMDAction, { code: number }[]][] = [
    [SelectIdleCMDAction.SELECT_SUMMON, prompt.summons],
    [SelectIdleCMDAction.SELECT_SPECIAL_SUMMON, prompt.special_summons],
    [SelectIdleCMDAction.SELECT_ACTIVATE, prompt.activates],
    [SelectIdleCMDAction.SELECT_MONSTER_SET, prompt.monster_sets],
  ];
  for (const [action, cards] of choices) {
    const index = cards.findIndex((c) => !keep(c.code));
    if (index >= 0)
      return { type: OcgResponseType.SELECT_IDLECMD, action, index };
  }
  return null;
}

export function createOpponent(options: OpponentOptions = {}): Responder {
  const ruleList = options.rules ?? HANDTRAP_RULES;
  const alias = options.alias ?? ((code: number) => code);
  const ruleFor = (code: number) =>
    ruleList.find((r) => r.code === alias(code) || r.code === code);

  return (prompt, duel) => {
    const { turnPlayer, messages } = currentTurn(duel);
    if (isRetry(messages)) return passiveResponse(prompt);
    const me = "player" in prompt ? prompt.player : -1;
    const myTurn = turnPlayer === me;

    switch (prompt.type) {
      case OcgMessageType.SELECT_CHAIN: {
        if (myTurn) break;
        const specialSummoned = messages.some(
          (m) => m.type === OcgMessageType.SPSUMMONED,
        );
        // One copy of each handtrap per turn: a second Droll or Veiler adds nothing.
        const used = new Set(
          messages.flatMap((m) =>
            m.type === OcgMessageType.CHAINING && m.controller === me
              ? [ruleFor(m.code)]
              : [],
          ),
        );
        const index = prompt.selects.findIndex((c) => {
          const rule = ruleFor(c.code);
          if (!rule || used.has(rule)) return false;
          return rule.when === "first-chance" || specialSummoned;
        });
        if (index >= 0) return { type: OcgResponseType.SELECT_CHAIN, index };
        break;
      }
      case OcgMessageType.SELECT_IDLECMD: {
        const actions = messages.filter(
          (m) => m.type === OcgMessageType.SELECT_IDLECMD,
        ).length;
        const action =
          actions <= MAX_ACTIONS
            ? idleAction(prompt, (code) => !!ruleFor(code))
            : null;
        if (action) return action;
        if (prompt.to_bp)
          return {
            type: OcgResponseType.SELECT_IDLECMD,
            action: SelectIdleCMDAction.TO_BP,
            index: null,
          };
        break;
      }
      case OcgMessageType.SELECT_BATTLECMD: {
        const index = prompt.attacks.findIndex((c) => c.can_direct);
        if (index >= 0)
          return {
            type: OcgResponseType.SELECT_BATTLECMD,
            action: SelectBattleCMDAction.SELECT_BATTLE,
            index,
          };
        break;
      }
    }
    return passiveResponse(prompt);
  };
}
