// A do-nothing opponent: never chains, ends its turn, picks the first legal choice.
import {
  openPlaces,
  OcgMessageType,
  OcgResponseType,
  SelectBattleCMDAction,
  SelectIdleCMDAction,
  type Message,
  type Response,
} from "@ygo/engine";

/** The lowest `count` set bits of `mask`, as single-bit values. */
function lowBits(mask: number, count: number): number[] {
  const out: number[] = [];
  for (let bit = 0; bit < 32 && out.length < count; bit++)
    if (mask & (1 << bit)) out.push(1 << bit);
  return out;
}

function lowBitsBig(mask: bigint, count: number): bigint[] {
  const out: bigint[] = [];
  for (let bit = 1n; bit <= mask && out.length < count; bit <<= 1n)
    if (mask & bit) out.push(bit);
  return out;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export function passiveResponse(prompt: Message): Response {
  switch (prompt.type) {
    case OcgMessageType.SELECT_IDLECMD:
      return {
        type: OcgResponseType.SELECT_IDLECMD,
        action: prompt.to_ep
          ? SelectIdleCMDAction.TO_EP
          : SelectIdleCMDAction.TO_BP,
        index: null,
      };
    case OcgMessageType.SELECT_BATTLECMD:
      return {
        type: OcgResponseType.SELECT_BATTLECMD,
        action: prompt.to_ep
          ? SelectBattleCMDAction.TO_EP
          : SelectBattleCMDAction.TO_M2,
        index: null,
      };
    case OcgMessageType.SELECT_CHAIN:
      return {
        type: OcgResponseType.SELECT_CHAIN,
        index: prompt.forced ? 0 : null,
      };
    case OcgMessageType.SELECT_EFFECTYN:
      return { type: OcgResponseType.SELECT_EFFECTYN, yes: false };
    case OcgMessageType.SELECT_YESNO:
      return { type: OcgResponseType.SELECT_YESNO, yes: false };
    case OcgMessageType.SELECT_OPTION:
      return { type: OcgResponseType.SELECT_OPTION, index: 0 };
    case OcgMessageType.SELECT_CARD:
      return { type: OcgResponseType.SELECT_CARD, indicies: range(prompt.min) };
    case OcgMessageType.SELECT_TRIBUTE:
      return {
        type: OcgResponseType.SELECT_TRIBUTE,
        indicies: range(prompt.min),
      };
    case OcgMessageType.SELECT_UNSELECT_CARD:
      return {
        type: OcgResponseType.SELECT_UNSELECT_CARD,
        index: prompt.can_finish ? null : 0,
      };
    case OcgMessageType.SELECT_PLACE:
      return {
        type: OcgResponseType.SELECT_PLACE,
        places: openPlaces(prompt).slice(0, prompt.count),
      };
    case OcgMessageType.SELECT_DISFIELD:
      return {
        type: OcgResponseType.SELECT_DISFIELD,
        places: openPlaces(prompt).slice(0, prompt.count),
      };
    case OcgMessageType.SELECT_POSITION:
      return {
        type: OcgResponseType.SELECT_POSITION,
        position: lowBits(prompt.positions, 1)[0] as never,
      };
    case OcgMessageType.SELECT_COUNTER: {
      let left = prompt.count;
      const counters = prompt.cards.map((c) => {
        const take = Math.min(left, c.count);
        left -= take;
        return take;
      });
      return { type: OcgResponseType.SELECT_COUNTER, counters };
    }
    case OcgMessageType.SELECT_SUM: {
      // Indices cover selects_must first, then selects; required cards are always included.
      const must = prompt.selects_must.length;
      const indicies = range(must);
      let total = prompt.selects_must.reduce((sum, c) => sum + c.amount, 0);
      const options = prompt.selects
        .map((c, i) => ({ i: i + must, amount: c.amount }))
        .sort((a, b) => b.amount - a.amount);
      for (const option of options) {
        if (total >= prompt.amount) break;
        if (total + option.amount > prompt.amount && prompt.select_max === 0)
          continue;
        indicies.push(option.i);
        total += option.amount;
      }
      return {
        type: OcgResponseType.SELECT_SUM,
        indicies: indicies.sort((a, b) => a - b),
      };
    }
    case OcgMessageType.SORT_CARD:
    case OcgMessageType.SORT_CHAIN:
      return { type: OcgResponseType.SORT_CARD, order: null };
    case OcgMessageType.ANNOUNCE_RACE:
      return {
        type: OcgResponseType.ANNOUNCE_RACE,
        races: lowBitsBig(BigInt(prompt.available), prompt.count) as never,
      };
    case OcgMessageType.ANNOUNCE_ATTRIB:
      return {
        type: OcgResponseType.ANNOUNCE_ATTRIB,
        attributes: lowBits(prompt.available, prompt.count) as never,
      };
    case OcgMessageType.ANNOUNCE_NUMBER:
      return { type: OcgResponseType.ANNOUNCE_NUMBER, value: 0 };
    case OcgMessageType.ROCK_PAPER_SCISSORS:
      return { type: OcgResponseType.ROCK_PAPER_SCISSORS, value: 1 };
    default:
      throw new Error(`passive opponent cannot answer message ${prompt.type}`);
  }
}
