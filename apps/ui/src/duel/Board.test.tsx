import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  CardLocation,
  type Board as BoardState,
  type PlayerBoard,
} from "@ygo/engine";
import { describe, expect, it, vi } from "vitest";
import type { ImageSource } from "../cards/CardImage";
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
  // Like the engine: hand cards come face-down.
  me.hand = [{ code: 2, position: 10 }];
  me.monsters[2] = { code: 1, position: 1, attack: 2000, defense: 100 };
  opp.lp = 7200;
  opp.hand = [{ code: 4, position: 10 }];
  opp.spells[0] = { code: 3, position: 10 };
  opp.grave = [{ code: 1, position: 1 }];
  return { players: [me, opp], turn: 1, turnPlayer: 0, phase: 4 };
}

function setup(
  selectable: string[] = [],
  images?: ImageSource,
  opts: { edit?: (b: BoardState) => void; tilted?: boolean } = {},
) {
  const onFocus = vi.fn();
  const onHover = vi.fn();
  const state = board();
  opts.edit?.(state);
  render(
    <Board
      board={state}
      tilted={opts.tilted}
      images={images}
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

  it("shows card art for face-up cards only", async () => {
    const images = {
      get: vi.fn(async (code: number) => new Uint8Array([code])),
    };
    URL.createObjectURL = vi.fn(() => "blob:art");
    URL.revokeObjectURL = vi.fn();
    setup([], images);
    const warwolf = screen.getByRole("button", {
      name: "Warwolf, Monster Zone 3, ATK 2000",
    });
    expect(await within(warwolf).findByRole("img")).toHaveAttribute(
      "src",
      "blob:art",
    );
    // The GY shows its top card too, so Warwolf may be asked twice.
    const asked = new Set(images.get.mock.calls.map(([code]) => code));
    expect([...asked].sort()).toEqual([1, 2]);
  });

  describe("table layout", () => {
    const column = (el: HTMLElement | null) =>
      el?.closest<HTMLElement>(".zone, .card, .pile")?.style.gridColumn;
    const row = (el: HTMLElement | null) =>
      el?.closest<HTMLElement>(".zone, .card, .pile")?.style.gridRow;

    it("places zones and piles like a real table, mirrored for the opponent", () => {
      setup();
      const mine = screen.getByRole("region", { name: "Your field" });
      const theirs = screen.getByRole("region", { name: "Opponent's field" });
      // Monster Zone 3 is the middle of five, in columns 2 to 6.
      expect(
        column(within(mine).getByRole("button", { name: /^Warwolf, Monster/ })),
      ).toBe("4");
      // The opponent's Spell & Trap Zone 1 sits on our right.
      expect(
        column(
          within(theirs).getByRole("button", {
            name: "Face-down card, Spell & Trap Zone 1",
          }),
        ),
      ).toBe("6");
      expect(column(within(mine).getByText("Deck 30"))).toBe("7");
      expect(column(within(theirs).getByText("Deck 30"))).toBe("1");
      expect(column(within(mine).getByText("GY 0"))).toBe("7");
      expect(column(within(theirs).getByText("GY 1"))).toBe("1");
      expect(column(within(mine).getByText("Extra 0"))).toBe("1");
      expect(column(within(mine).getByText("Banished 0"))).toBe("7");
      expect(column(within(mine).getByLabelText("Empty Field Zone"))).toBe("1");
    });

    it("shares one Extra Monster Zone row between both players", () => {
      setup([], undefined, {
        // The opponent's right Extra Monster Zone is our left one.
        edit: (b) => {
          b.players[1].monsters[6] = { code: 1, position: 1, attack: 2000 };
        },
      });
      const mine = screen.getByRole("region", { name: "Your field" });
      const theirs = screen.getByRole("region", { name: "Opponent's field" });
      const taken = within(theirs).getByRole("button", {
        name: /^Warwolf, Extra Monster Zone right/,
      });
      expect(column(taken)).toBe("3");
      expect(
        within(mine).queryByLabelText("Empty Extra Monster Zone left"),
      ).toBeNull();
      const free = within(mine).getByLabelText(
        "Empty Extra Monster Zone right",
      );
      expect(column(free)).toBe("5");
      // Both rows meet: the opponent's last row is our first.
      expect(row(taken)).toBe("3");
      expect(row(free)).toBe("1");
    });

    it("tilts the field only when asked", () => {
      setup([], undefined, { tilted: true });
      expect(document.querySelector(".board")).toHaveClass("board--tilted");
    });

    it("keeps both hands outside the field grid", () => {
      setup();
      const mine = screen.getByRole("region", { name: "Your field" });
      const raider = within(mine).getByRole("button", { name: "Raider, hand" });
      expect(raider.closest(".hand")).not.toBeNull();
      expect(raider.closest(".field")).toBeNull();
    });
  });
});
