import { describe, expect, it } from "vitest";
import {
  compactionStats,
  costStats,
  renderHtml,
  reviewStats,
  verdicts,
} from "./jev-tools-report.mjs";

const full = {
  baseline: {
    from: "2026-09-09",
    to: "2026-10-09T08:00Z",
    ...costStats(
      [
        { day: "a", cost: 10 },
        { day: "b", cost: 10 },
      ],
      4,
    ),
  },
  trial: {
    from: "2026-10-09T08:00Z",
    to: "2026-10-16T16:00Z",
    ...costStats(
      [
        { day: "c", cost: 6 },
        { day: "d", cost: 6 },
      ],
      4,
    ),
  },
  router: {
    requests: 50,
    saved_usd: 3,
    baseline_usd: 10,
    jev: { fallback_rate: 0.02, p95_ms: 120 },
  },
  compaction: compactionStats([{ preTokens: 500, postTokens: 100 }]),
  coverage: {
    first: { id: "r1", lines: 90, branches: 73 },
    last: { id: "r2", lines: 91, branches: 75 },
  },
  review: reviewStats([{ verdict: "fixed" }, { verdict: "false-positive" }]),
  manual: { typesafeUsd: 1, lostContext: 0, routerOverrides: 1, gapsClosed: 2 },
};

describe("stats", () => {
  it("sums cost per active day and per commit", () => {
    expect(
      costStats(
        [
          { day: "a", cost: 2 },
          { day: "a", cost: 4 },
        ],
        3,
      ),
    ).toMatchObject({ cost: 6, days: 1, perDay: 6, perCommit: 2 });
  });
  it("gives null ratios with no days or commits", () => {
    expect(costStats([], 0)).toMatchObject({ perDay: null, perCommit: null });
  });
  it("counts tokens saved, and none when the next turn is missing", () => {
    expect(
      compactionStats([
        { preTokens: 500, postTokens: 120 },
        { preTokens: 300 },
      ]),
    ).toEqual({ count: 2, tokensSaved: 380 });
  });
  it("takes precision as fixed over all findings", () => {
    expect(
      reviewStats([
        { verdict: "fixed" },
        { verdict: "ignored" },
        { verdict: "ignored" },
        { verdict: "fixed" },
      ]),
    ).toEqual({ total: 4, fixed: 2, precision: 0.5 });
  });
});

describe("verdicts", () => {
  it("keeps every tool that meets its bar", () => {
    const v = verdicts(full);
    expect(
      Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.verdict])),
    ).toEqual({
      all: "keep",
      router: "keep",
      compaction: "keep",
      coverage: "keep",
      review: "keep",
    });
    // (6+6+1)/2 days = 6.5 vs 10 → 35 % down
    expect(v.all.dayDrop).toBeCloseTo(0.35);
  });
  it("counts TypeSafe spend against the saving", () => {
    expect(
      verdicts({ ...full, manual: { ...full.manual, typesafeUsd: 6 } }).all
        .verdict,
    ).toBe("drop");
  });
  it("waits when manual input or data is missing", () => {
    const v = verdicts({
      ...full,
      router: { requests: 0 },
      compaction: { count: 0, tokensSaved: 0 },
      coverage: { first: full.coverage.first, last: full.coverage.first },
      review: reviewStats([]),
      manual: {},
    });
    for (const x of Object.values(v)) expect(x.verdict).toBe("wait");
  });
  it("drops on lost context, low savings, low precision", () => {
    const v = verdicts({
      ...full,
      router: { ...full.router, saved_usd: 1 },
      review: reviewStats([
        { verdict: "fixed" },
        ...Array(4).fill({ verdict: "ignored" }),
      ]),
      manual: { ...full.manual, lostContext: 1 },
    });
    expect([v.router.verdict, v.compaction.verdict, v.review.verdict]).toEqual([
      "drop",
      "drop",
      "drop",
    ]);
  });
});

describe("renderHtml", () => {
  it("shows each tool with its verdict and escapes text", () => {
    const html = renderHtml(
      { ...full, baseline: { ...full.baseline, from: "<x>" } },
      verdicts(full),
    );
    for (const t of ["Router", "save-token-jev", "supercov", "jev-review"])
      expect(html).toContain(t);
    expect(html).toContain('class="keep"');
    expect(html).toContain("&lt;x&gt;");
    expect(html).not.toContain("<x>");
  });
});
