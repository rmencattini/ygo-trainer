// Plain-English lines for the duel log. "You" is the human player.
import {
  OcgLocation,
  OcgMessageType,
  OcgPhase,
  type OcgLocPos,
  type OcgMessage,
} from "ocgcore-wasm";

export interface TextSource {
  name(code: number): string;
  /** Card string `str<index+1>` from the card DB, if any. */
  cardString(code: number, index: number): string | undefined;
  /** System string from `strings.conf`, if any. */
  system(id: number): string | undefined;
}

/** Card at a field location, or 0 if unknown. ATTACK messages only carry locations. */
export type CodeAt = (loc: OcgLocPos) => number;

/** Effect descriptions are `code << 20 | index` for card strings, small numbers for system strings. */
export function describeEffect(description: bigint, texts: TextSource): string {
  const code = Number(description >> 20n);
  if (code > 0) {
    const index = Number(description & 0xfffffn);
    return texts.cardString(code, index) ?? `${texts.name(code)} effect`;
  }
  return texts.system(Number(description)) ?? "Effect";
}

const PHASES: Partial<Record<number, string>> = {
  [OcgPhase.DRAW]: "Draw Phase",
  [OcgPhase.STANDBY]: "Standby Phase",
  [OcgPhase.MAIN1]: "Main Phase 1",
  [OcgPhase.BATTLE_START]: "Battle Phase",
  [OcgPhase.MAIN2]: "Main Phase 2",
  [OcgPhase.END]: "End Phase",
};

export function logLine(
  message: OcgMessage,
  texts: TextSource,
  me: number,
  codeAt: CodeAt = () => 0,
): string | null {
  const who = (player: number) => (player === me ? "You" : "Opponent");
  const verb = (player: number, base: string, s = `${base}s`) =>
    `${who(player)} ${player === me ? base : s}`;
  const your = (player: number) => (player === me ? "your" : "the opponent's");
  const cardName = (code: number) => (code ? texts.name(code) : "a card");

  switch (message.type) {
    case OcgMessageType.NEW_TURN:
      return message.player === me ? "Your turn" : "Opponent's turn";
    case OcgMessageType.NEW_PHASE:
      return PHASES[message.phase] ?? null;
    case OcgMessageType.DRAW: {
      const n = message.drawn.length;
      if (message.player === me && message.drawn.every((c) => c.code)) {
        return `You draw ${message.drawn.map((c) => texts.name(c.code)).join(", ")}`;
      }
      return `${verb(message.player, "draw")} ${n} card${n === 1 ? "" : "s"}`;
    }
    case OcgMessageType.SUMMONING:
      return `${verb(message.controller, "Normal Summon")} ${cardName(message.code)}`;
    case OcgMessageType.SPSUMMONING:
      return `${verb(message.controller, "Special Summon")} ${cardName(message.code)}`;
    case OcgMessageType.FLIPSUMMONING:
      return `${verb(message.controller, "Flip Summon")} ${cardName(message.code)}`;
    case OcgMessageType.SET:
      return `${verb(message.controller, "Set")} ${message.controller === me ? cardName(message.code) : "a card"}`;
    case OcgMessageType.CHAINING:
      return `Chain Link ${message.chain_size}: ${verb(message.controller, "activate")} ${cardName(message.code)} (${describeEffect(message.description, texts)})`;
    case OcgMessageType.CHAIN_SOLVING:
      return `Chain Link ${message.chain_size} resolves`;
    case OcgMessageType.CHAIN_NEGATED:
      return `Chain Link ${message.chain_size} is negated`;
    case OcgMessageType.CHAIN_DISABLED:
      return `Chain Link ${message.chain_size}: effect is negated`;
    case OcgMessageType.MOVE: {
      const { from, to } = message;
      const name = cardName(message.card);
      if (to.location === OcgLocation.GRAVE)
        return `${name} is sent to ${your(to.controller)} GY`;
      if (to.location === OcgLocation.REMOVED) return `${name} is banished`;
      if (
        to.location === OcgLocation.HAND &&
        from.location !== OcgLocation.HAND
      ) {
        return `${verb(to.controller, "add", "adds")} ${name} to ${to.controller === me ? "your" : "their"} hand`;
      }
      if (
        to.location === OcgLocation.DECK &&
        from.location !== OcgLocation.DECK
      ) {
        return `${name} returns to ${your(to.controller)} Deck`;
      }
      return null;
    }
    case OcgMessageType.DAMAGE:
      return `${verb(message.player, "take")} ${message.amount} damage`;
    case OcgMessageType.RECOVER:
      return `${verb(message.player, "gain")} ${message.amount} LP`;
    case OcgMessageType.PAY_LPCOST:
      return `${verb(message.player, "pay")} ${message.amount} LP`;
    case OcgMessageType.ATTACK: {
      const attacker = cardName(codeAt(message.card));
      return message.target
        ? `${attacker} attacks ${cardName(codeAt(message.target))}`
        : `${attacker} attacks directly`;
    }
    case OcgMessageType.WIN:
      return message.player === me ? "You win" : "Opponent wins";
    default:
      return null;
  }
}
