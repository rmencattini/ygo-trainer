import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  CardLocation,
  type Board as BoardState,
  type PlayerBoard,
} from "@ygo/engine";
import { describe, expect, it, vi } from "vitest";
import { Board } from "./Board";

const NAMES: Record<number, string> = {
  1: "Warwolf",
  2: "Raider",
  3: "Secret Trap",
  4: "Hidden Hand Card",
};
const empty = (): PlayerBoard => ({
  lp: 8000,
  deck: 30,
  hand: [],
  monsters: Array(7).fill(null),
  spells: Array(8).fill(null),
  grave: [],
  banished: [],
  extra: [],
});

function board(): BoardState {
  const me = empty();
  const opp = empty();
  me.hand = [{ code: 2, position: 1 }];
  me.monsters[2] = { code: 1, position: 1, attack: 2000, defense: 100 };
  opp.lp = 7200;
  opp.hand = [{ code: 4, position: 10 }];
  opp.spells[0] = { code: 3, position: 10 };
  opp.grave = [{ code: 1, position: 1 }];
  return { players: [me, opp], turn: 1, turnPlayer: 0, phase: 4 };
}

function setup(selectable: string[] = []) {
  const onFocus = vi.fn();
  const onHover = vi.fn();
  render(
    <Board
      board={board()}
      me={0}
      name={(code) => NAMES[code]}
      selectable={new Set(selectable)}
      focus={null}
      onFocus={onFocus}
      onHover={onHover}
    />,
  );
  return { onFocus, onHover };
}

describe("Board", () => {
  it("shows your cards by name in their zones", () => {
    setup();
    const mine = screen.getByRole("region", { name: "Your field" });
    expect(
      within(mine).getByRole("button", {
        name: "Warwolf, Monster Zone 3, ATK 2000",
      }),
    ).toBeInTheDocument();
    expect(
      within(mine).getByRole("button", { name: "Raider, hand" }),
    ).toBeInTheDocument();
    expect(within(mine).getByText("LP 8000")).toBeInTheDocument();
  });

  it("hides the opponent's hand and face-down cards", () => {
    setup();
    const theirs = screen.getByRole("region", { name: "Opponent's field" });
    expect(
      within(theirs).queryByText(/Hidden Hand Card|Secret Trap/),
    ).toBeNull();
    expect(
      within(theirs).getByRole("button", { name: "Face-down card, hand" }),
    ).toBeInTheDocument();
    expect(
      within(theirs).getByRole("button", {
        name: "Face-down card, Spell & Trap Zone 1",
      }),
    ).toBeInTheDocument();
    expect(within(theirs).getByText("LP 7200")).toBeInTheDocument();
    expect(within(theirs).getByTitle("GY: Warwolf")).toHaveTextContent("GY 1");
  });

  it("lets you click cards the prompt uses and hover any visible card", () => {
    const { onFocus, onHover } = setup([`0-${CardLocation.HAND}-0`]);
    const raider = screen.getByRole("button", { name: "Raider, hand" });
    expect(raider).toHaveClass("card--selectable");
    fireEvent.click(raider);
    expect(onFocus).toHaveBeenCalledWith({
      controller: 0,
      location: CardLocation.HAND,
      sequence: 0,
    });
    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "Warwolf, Monster Zone 3, ATK 2000" }),
    );
    expect(onHover).toHaveBeenCalledWith(1);
  });
});
