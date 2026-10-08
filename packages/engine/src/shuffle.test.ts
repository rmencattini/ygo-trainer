import { describe, expect, it } from "vitest";
import { mixSeed, seededShuffle } from "./shuffle";

const cards = Array.from({ length: 40 }, (_, i) => i);

describe("seededShuffle", () => {
  it("keeps every card", () => {
    expect([...seededShuffle(cards, 7n)].sort((a, b) => a - b)).toEqual(cards);
  });

  it("gives the same order for the same seed and another for another seed", () => {
    expect(seededShuffle(cards, 7n)).toEqual(seededShuffle(cards, 7n));
    expect(seededShuffle(cards, 7n)).not.toEqual(seededShuffle(cards, 8n));
  });

  it("does not change the input", () => {
    const input = [1, 2, 3];
    seededShuffle(input, 1n);
    expect(input).toEqual([1, 2, 3]);
  });
});

describe("mixSeed", () => {
  it("differs per team and per seed, even for repeated parts", () => {
    const values = [
      mixSeed([1n, 1n, 1n, 1n], 0),
      mixSeed([9n, 9n, 9n, 9n], 0),
      mixSeed([9n, 9n, 9n, 9n], 1),
    ];
    expect(new Set(values).size).toBe(3);
  });
});
