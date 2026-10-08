import {
  CardLocation,
  MessageType,
  ResponseType,
  SelectBattleCMDAction,
  SelectIdleCMDAction,
  type Message,
} from "@ygo/engine";
import { describe, expect, it } from "vitest";
import { passiveResponse } from "./passive";

const msg = (m: Partial<Message> & { type: MessageType }) =>
  ({ player: 1, ...m }) as Message;
const loc = (code: number, sequence = 0) => ({
  code,
  controller: 1 as const,
  location: CardLocation.HAND,
  sequence,
  position: 1 as const,
});

describe("passiveResponse", () => {
  it("ends the turn from main and battle phase", () => {
    expect(
      passiveResponse(
        msg({
          type: MessageType.SELECT_IDLECMD,
          to_ep: true,
          to_bp: true,
        } as never),
      ),
    ).toEqual({
      type: ResponseType.SELECT_IDLECMD,
      action: SelectIdleCMDAction.TO_EP,
      index: null,
    });
    expect(
      passiveResponse(
        msg({ type: MessageType.SELECT_BATTLECMD, to_ep: true } as never),
      ),
    ).toMatchObject({
      action: SelectBattleCMDAction.TO_EP,
    });
  });

  it("never chains unless forced", () => {
    expect(
      passiveResponse(
        msg({
          type: MessageType.SELECT_CHAIN,
          forced: false,
          selects: [],
        } as never),
      ),
    ).toEqual({
      type: ResponseType.SELECT_CHAIN,
      index: null,
    });
    expect(
      passiveResponse(
        msg({
          type: MessageType.SELECT_CHAIN,
          forced: true,
          selects: [{}],
        } as never),
      ),
    ).toEqual({
      type: ResponseType.SELECT_CHAIN,
      index: 0,
    });
  });

  it("says no to optional effects", () => {
    expect(
      passiveResponse(msg({ type: MessageType.SELECT_EFFECTYN } as never)),
    ).toMatchObject({ yes: false });
    expect(
      passiveResponse(msg({ type: MessageType.SELECT_YESNO } as never)),
    ).toMatchObject({ yes: false });
  });

  it("picks the minimum number of cards", () => {
    const selects = [loc(1), loc(2), loc(3)];
    expect(
      passiveResponse(
        msg({
          type: MessageType.SELECT_CARD,
          min: 2,
          max: 3,
          selects,
        } as never),
      ),
    ).toEqual({
      type: ResponseType.SELECT_CARD,
      indicies: [0, 1],
    });
    expect(
      passiveResponse(
        msg({
          type: MessageType.SELECT_TRIBUTE,
          min: 1,
          max: 2,
          selects,
        } as never),
      ),
    ).toEqual({
      type: ResponseType.SELECT_TRIBUTE,
      indicies: [0],
    });
  });

  it("finishes or picks the first card in select/unselect", () => {
    const m = {
      type: MessageType.SELECT_UNSELECT_CARD,
      select_cards: [loc(1)],
      unselect_cards: [],
    };
    expect(
      passiveResponse(msg({ ...m, can_finish: true } as never)),
    ).toMatchObject({ index: null });
    expect(
      passiveResponse(msg({ ...m, can_finish: false } as never)),
    ).toMatchObject({ index: 0 });
  });

  it("takes the first allowed position, zone, option and declaration", () => {
    expect(
      passiveResponse(
        msg({ type: MessageType.SELECT_POSITION, positions: 0b1100 } as never),
      ),
    ).toMatchObject({
      position: 0b0100,
    });
    expect(
      passiveResponse(
        msg({
          type: MessageType.SELECT_PLACE,
          player: 1,
          count: 1,
          field_mask: 0b1,
        } as never),
      ),
    ).toMatchObject({
      places: [{ player: 1, location: CardLocation.MZONE, sequence: 1 }],
    });
    expect(
      passiveResponse(
        msg({ type: MessageType.SELECT_OPTION, options: [5n, 6n] } as never),
      ),
    ).toMatchObject({
      index: 0,
    });
    expect(
      passiveResponse(
        msg({
          type: MessageType.ANNOUNCE_RACE,
          count: 1,
          available: 0b1010n,
        } as never),
      ),
    ).toMatchObject({ races: [0b10n] });
    expect(
      passiveResponse(
        msg({
          type: MessageType.ANNOUNCE_ATTRIB,
          count: 1,
          available: 0b100,
        } as never),
      ),
    ).toMatchObject({ attributes: [0b100] });
    expect(
      passiveResponse(
        msg({ type: MessageType.ANNOUNCE_NUMBER, options: [3n, 4n] } as never),
      ),
    ).toMatchObject({
      value: 0,
    });
  });

  it("keeps the order when asked to sort", () => {
    expect(
      passiveResponse(msg({ type: MessageType.SORT_CARD, cards: [] } as never)),
    ).toEqual({
      type: ResponseType.SORT_CARD,
      order: null,
    });
  });

  it("reaches the sum with the fewest cards, keeping required ones", () => {
    const res = passiveResponse(
      msg({
        type: MessageType.SELECT_SUM,
        select_max: 0,
        amount: 8,
        min: 1,
        max: 3,
        selects_must: [{ ...loc(9), amount: 4 }],
        selects: [
          { ...loc(1), amount: 2 },
          { ...loc(2), amount: 4 },
        ],
      } as never),
    );
    expect(res).toEqual({ type: ResponseType.SELECT_SUM, indicies: [0, 2] });
  });
});
