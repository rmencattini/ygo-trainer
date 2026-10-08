import { fireEvent, render, screen } from "@testing-library/react";
import {
  CardLocation,
  MessageType,
  OcgAttribute,
  OcgRPS,
  ResponseType,
  SelectBattleCMDAction,
  SelectIdleCMDAction,
  type Message,
} from "@ygo/engine";
import { describe, expect, it, vi } from "vitest";
import { PromptPanel } from "./PromptPanel";
import type { PromptContext } from "./context";

const NAMES: Record<number, string> = {
  1: "Warwolf",
  2: "Raider",
  3: "Ash Blossom",
  4: "Dragon",
};
const ctx: PromptContext = {
  me: 0,
  name: (code) => NAMES[code] ?? `#${code}`,
  describe: (desc) => `effect ${desc}`,
  hint: null,
  focus: null,
  announceCandidates: (_opcodes, query) =>
    [
      { code: 3, name: "Ash Blossom" },
      { code: 4, name: "Dragon" },
    ].filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
};
const card = (
  code: number,
  location: number = CardLocation.HAND,
  sequence = 0,
  controller: 0 | 1 = 0,
) => ({
  code,
  controller,
  location,
  sequence,
  position: 1,
});

function show(
  // Fixtures stay loose: only the fields each prompt reads.
  prompt: { type: MessageType; [field: string]: unknown },
  extra: Partial<PromptContext> = {},
) {
  const respond = vi.fn();
  render(
    <PromptPanel
      prompt={{ player: 0, ...prompt } as unknown as Message}
      ctx={{ ...ctx, ...extra }}
      respond={respond}
    />,
  );
  return respond;
}
const click = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("SELECT_IDLECMD", () => {
  const idle = {
    type: MessageType.SELECT_IDLECMD,
    summons: [card(1), card(2, CardLocation.HAND, 1)],
    special_summons: [],
    pos_changes: [],
    monster_sets: [card(1)],
    spell_sets: [],
    activates: [{ ...card(3), description: 7n, client_mode: 0 }],
    to_bp: false,
    to_ep: true,
    shuffle: false,
  };

  it("offers every action and the end of turn", () => {
    const respond = show(idle);
    click("Normal Summon Raider");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_IDLECMD,
      action: SelectIdleCMDAction.SELECT_SUMMON,
      index: 1,
    });
    click("Activate Ash Blossom: effect 7");
    expect(respond).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: SelectIdleCMDAction.SELECT_ACTIVATE,
        index: 0,
      }),
    );
    click("End Turn");
    expect(respond).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: SelectIdleCMDAction.TO_EP }),
    );
    expect(screen.queryByRole("button", { name: "Battle Phase" })).toBeNull();
  });

  it("shows only the focused card's actions", () => {
    show(idle, {
      focus: { controller: 0, location: CardLocation.HAND, sequence: 0 },
    });
    expect(
      screen.getByRole("button", { name: "Normal Summon Warwolf" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Set Warwolf" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Normal Summon Raider" }),
    ).toBeNull();
  });
});

describe("SELECT_BATTLECMD", () => {
  it("offers attacks, activations and phase changes", () => {
    const respond = show({
      type: MessageType.SELECT_BATTLECMD,
      chains: [],
      attacks: [{ ...card(1, CardLocation.MZONE), can_direct: true }],
      to_m2: true,
      to_ep: true,
    });
    click("Attack with Warwolf");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_BATTLECMD,
      action: SelectBattleCMDAction.SELECT_BATTLE,
      index: 0,
    });
    click("Main Phase 2");
    expect(respond).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: SelectBattleCMDAction.TO_M2 }),
    );
  });
});

describe("SELECT_EFFECTYN and SELECT_YESNO", () => {
  it("asks yes or no for an effect", () => {
    const respond = show({
      type: MessageType.SELECT_EFFECTYN,
      description: 5n,
      ...card(3),
    });
    expect(screen.getByText(/Ash Blossom/)).toBeInTheDocument();
    click("Yes");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_EFFECTYN,
      yes: true,
    });
  });

  it("asks a yes/no question", () => {
    const respond = show({ type: MessageType.SELECT_YESNO, description: 30n });
    expect(screen.getByText("effect 30")).toBeInTheDocument();
    click("No");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_YESNO,
      yes: false,
    });
  });
});

describe("SELECT_OPTION", () => {
  it("lists the options", () => {
    const respond = show({
      type: MessageType.SELECT_OPTION,
      options: [10n, 11n],
    });
    click("effect 11");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_OPTION,
      index: 1,
    });
  });
});

describe("SELECT_CARD", () => {
  const prompt = {
    type: MessageType.SELECT_CARD,
    can_cancel: true,
    min: 1,
    max: 2,
    selects: [card(1), card(2), card(4)],
  };

  it("confirms once enough cards are picked", () => {
    const respond = show(prompt);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    click("Warwolf");
    click("Dragon");
    click("Confirm");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_CARD,
      indicies: [0, 2],
    });
  });

  it("can cancel when allowed", () => {
    const respond = show(prompt);
    click("Cancel");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_CARD,
      indicies: null,
    });
  });

  it("uses the hint as the title", () => {
    show(prompt, { hint: "Select the card(s) to add to your hand" });
    expect(
      screen.getByText("Select the card(s) to add to your hand"),
    ).toBeInTheDocument();
  });
});

describe("SELECT_TRIBUTE", () => {
  it("counts each card's tribute value", () => {
    const respond = show({
      type: MessageType.SELECT_TRIBUTE,
      can_cancel: false,
      min: 2,
      max: 2,
      selects: [
        { ...card(1, CardLocation.MZONE), release_param: 2 },
        { ...card(2, CardLocation.MZONE, 1), release_param: 1 },
      ],
    });
    click("Warwolf");
    click("Confirm");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_TRIBUTE,
      indicies: [0],
    });
  });
});

describe("SELECT_UNSELECT_CARD", () => {
  it("picks or drops one card at a time and can finish", () => {
    const respond = show({
      type: MessageType.SELECT_UNSELECT_CARD,
      can_finish: true,
      can_cancel: false,
      min: 1,
      max: 2,
      select_cards: [card(1)],
      unselect_cards: [card(2)],
    });
    click("Pick Warwolf");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_UNSELECT_CARD,
      index: 0,
    });
    click("Drop Raider");
    expect(respond).toHaveBeenLastCalledWith({
      type: ResponseType.SELECT_UNSELECT_CARD,
      index: 1,
    });
    click("Finish");
    expect(respond).toHaveBeenLastCalledWith({
      type: ResponseType.SELECT_UNSELECT_CARD,
      index: null,
    });
  });
});

describe("SELECT_CHAIN", () => {
  it("lets you chain or pass", () => {
    const respond = show({
      type: MessageType.SELECT_CHAIN,
      forced: false,
      spe_count: 0,
      selects: [{ ...card(3), description: 9n, client_mode: 0 }],
    });
    click("Activate Ash Blossom: effect 9");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_CHAIN,
      index: 0,
    });
    click("Don't chain");
    expect(respond).toHaveBeenLastCalledWith({
      type: ResponseType.SELECT_CHAIN,
      index: null,
    });
  });

  it("hides the pass button when the chain is forced", () => {
    show({
      type: MessageType.SELECT_CHAIN,
      forced: true,
      spe_count: 0,
      selects: [{ ...card(3), description: 9n, client_mode: 0 }],
    });
    expect(screen.queryByRole("button", { name: "Don't chain" })).toBeNull();
  });
});

describe("SELECT_PLACE and SELECT_DISFIELD", () => {
  it("answers with the zone you click", () => {
    // Every zone blocked except your Monster Zones 2 and 3.
    const mask = ~0b0110 >>> 0;
    const respond = show({
      type: MessageType.SELECT_PLACE,
      count: 1,
      field_mask: mask,
    });
    click("Your Monster Zone 3");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_PLACE,
      places: [{ player: 0, location: CardLocation.MZONE, sequence: 2 }],
    });
  });

  it("collects several zones before answering", () => {
    const mask = ~((0b11 << 8) | (0b1 << 16)) >>> 0;
    const respond = show({
      type: MessageType.SELECT_DISFIELD,
      count: 2,
      field_mask: mask,
    });
    click("Your Spell & Trap Zone 1");
    expect(respond).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Your Spell & Trap Zone 1" }),
    ).toBeNull();
    click("Opponent's Monster Zone 1");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_DISFIELD,
      places: [
        { player: 0, location: CardLocation.SZONE, sequence: 0 },
        { player: 1, location: CardLocation.MZONE, sequence: 0 },
      ],
    });
  });
});

describe("SELECT_POSITION", () => {
  it("offers the allowed positions", () => {
    const respond = show({
      type: MessageType.SELECT_POSITION,
      code: 1,
      positions: 0b0101,
    });
    expect(
      screen.queryByRole("button", { name: "Face-down Defense" }),
    ).toBeNull();
    click("Face-up Defense");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_POSITION,
      position: 0b0100,
    });
  });
});

describe("SELECT_COUNTER", () => {
  it("spreads the counters to remove", () => {
    const respond = show({
      type: MessageType.SELECT_COUNTER,
      counter_type: 1,
      count: 2,
      cards: [
        { ...card(1, CardLocation.MZONE), count: 1 },
        { ...card(2, CardLocation.MZONE, 1), count: 3 },
      ],
    });
    fireEvent.change(screen.getByLabelText("Counters from Raider"), {
      target: { value: "2" },
    });
    click("Confirm");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_COUNTER,
      counters: [0, 2],
    });
  });
});

describe("SELECT_SUM", () => {
  it("needs the exact total and always includes required cards", () => {
    const respond = show({
      type: MessageType.SELECT_SUM,
      select_max: 0,
      amount: 8,
      min: 1,
      max: 3,
      selects_must: [{ ...card(4), amount: 4 }],
      selects: [
        { ...card(1), amount: 2 },
        { ...card(2), amount: 4 },
      ],
    });
    click("Warwolf (2)");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    click("Warwolf (2)");
    click("Raider (4)");
    click("Confirm");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SELECT_SUM,
      indicies: [0, 2],
    });
  });
});

describe("SORT_CARD and SORT_CHAIN", () => {
  it("sends the new order", () => {
    const respond = show({
      type: MessageType.SORT_CARD,
      cards: [card(1), card(2), card(4)],
    });
    click("Move Dragon up");
    click("Confirm order");
    // Card i goes to position order[i]: Dragon moves above Raider.
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SORT_CARD,
      order: [0, 2, 1],
    });
  });

  it("can keep the default order", () => {
    const respond = show({
      type: MessageType.SORT_CHAIN,
      cards: [card(1), card(2)],
    });
    click("Keep order");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.SORT_CARD,
      order: null,
    });
  });
});

describe("ANNOUNCE_RACE and ANNOUNCE_ATTRIB", () => {
  it("declares a Type", () => {
    const respond = show({
      type: MessageType.ANNOUNCE_RACE,
      count: 1,
      available: 8192n | 1n,
    });
    click("Dragon");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.ANNOUNCE_RACE,
      races: [8192n],
    });
  });

  it("declares two Attributes", () => {
    const respond = show({
      type: MessageType.ANNOUNCE_ATTRIB,
      count: 2,
      available: OcgAttribute.DARK | OcgAttribute.LIGHT | OcgAttribute.FIRE,
    });
    click("Light");
    click("Dark");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.ANNOUNCE_ATTRIB,
      attributes: [OcgAttribute.LIGHT, OcgAttribute.DARK],
    });
  });
});

describe("ANNOUNCE_CARD", () => {
  it("declares a card name found by search", () => {
    const respond = show({ type: MessageType.ANNOUNCE_CARD, opcodes: [] });
    fireEvent.change(screen.getByLabelText("Card name"), {
      target: { value: "ash" },
    });
    click("Ash Blossom");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.ANNOUNCE_CARD,
      card: 3,
    });
  });
});

describe("ANNOUNCE_NUMBER", () => {
  it("declares one of the offered numbers", () => {
    const respond = show({
      type: MessageType.ANNOUNCE_NUMBER,
      options: [4n, 7n],
    });
    click("7");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.ANNOUNCE_NUMBER,
      value: 1,
    });
  });
});

describe("ROCK_PAPER_SCISSORS", () => {
  it("throws a hand", () => {
    const respond = show({ type: MessageType.ROCK_PAPER_SCISSORS });
    click("Paper");
    expect(respond).toHaveBeenCalledWith({
      type: ResponseType.ROCK_PAPER_SCISSORS,
      value: OcgRPS.PAPER,
    });
  });
});
