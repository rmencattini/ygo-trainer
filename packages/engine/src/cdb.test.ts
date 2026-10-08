import { describe, expect, it } from "vitest";
import { rowToCardData } from "./cdb";

const base = {
  id: 1,
  alias: 0,
  setcode: 0,
  type: 0x11,
  atk: 0,
  def: 0,
  level: 0,
  race: 0,
  attribute: 0,
};

describe("rowToCardData", () => {
  it("maps a plain monster", () => {
    const card = rowToCardData({
      ...base,
      id: 89631139,
      setcode: 221,
      atk: 3000,
      def: 2500,
      level: 8,
      race: 8192,
      attribute: 16,
    });
    expect(card).toEqual({
      code: 89631139,
      alias: 0,
      setcodes: [221],
      type: 0x11,
      level: 8,
      attribute: 16,
      race: 8192n,
      attack: 3000,
      defense: 2500,
      lscale: 0,
      rscale: 0,
      link_marker: 0,
    });
  });

  it("unpacks up to four 16-bit setcodes", () => {
    const setcode = 0x0001 + 0x0002 * 2 ** 16 + 0x0003 * 2 ** 32;
    expect(rowToCardData({ ...base, setcode }).setcodes).toEqual([1, 2, 3]);
  });

  it("reads pendulum scales from the level field", () => {
    const card = rowToCardData({ ...base, level: (5 << 24) | (5 << 16) | 4 });
    expect([card.level, card.lscale, card.rscale]).toEqual([4, 5, 5]);
  });

  it("reads link markers from defense on Link monsters", () => {
    const card = rowToCardData({
      ...base,
      type: 0x4000021,
      def: 0b101,
      level: 2,
    });
    expect([card.defense, card.link_marker]).toEqual([0, 0b101]);
  });
});
