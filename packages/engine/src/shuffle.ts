const MASK = (1n << 64n) - 1n;

// SplitMix64: small, fast and enough for deck order. Not for anything secret.
function splitmix64(state: bigint): () => bigint {
  return () => {
    state = (state + 0x9e3779b97f4a7c15n) & MASK;
    let z = state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return z ^ (z >> 31n);
  };
}

/** Fisher-Yates shuffle driven by `seed`, so the same seed gives the same order. */
export function seededShuffle<T>(items: readonly T[], seed: bigint): T[] {
  const next = splitmix64(seed & MASK);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Number(next() % BigInt(i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Folds the 4-part duel seed and a team index into one shuffle seed. */
export function mixSeed(seed: readonly bigint[], team: number): bigint {
  let state = BigInt(team);
  for (const part of seed) state = splitmix64(state ^ part)();
  return state;
}
