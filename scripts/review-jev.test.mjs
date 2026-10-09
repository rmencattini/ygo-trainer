import { describe, expect, it } from "vitest";
import { formatFindings, reviewEnv, skipReason } from "./review-jev.mjs";

describe("skipReason", () => {
  it("skips without a TypeSafe key", () => {
    expect(skipReason({ env: {}, hasDeps: true })).toMatch(/TYPESAFE_API_KEY/);
  });
  it("skips when tools/jev-review has no node_modules", () => {
    expect(
      skipReason({ env: { TYPESAFE_API_KEY: "x" }, hasDeps: false }),
    ).toMatch(/npm run tools:build/);
  });
  it("runs with a key and built deps", () => {
    expect(
      skipReason({ env: { TYPESAFE_API_KEY: "x" }, hasDeps: true }),
    ).toBeNull();
  });
});

describe("reviewEnv", () => {
  it("keeps a key already in the environment", () => {
    const read = () => "from-keychain";
    expect(reviewEnv({ TYPESAFE_API_KEY: "set" }, read).TYPESAFE_API_KEY).toBe(
      "set",
    );
  });
  it("reads the key from Keychain when the variable is missing", () => {
    expect(reviewEnv({}, () => "from-keychain").TYPESAFE_API_KEY).toBe(
      "from-keychain",
    );
  });
  it("leaves the key unset when Keychain has none", () => {
    expect(reviewEnv({}, () => null)).not.toHaveProperty("TYPESAFE_API_KEY");
  });
});

const finding = (over) => ({
  file: "src/a.ts",
  line: 12,
  dimension: "correctness",
  probability: 0.9,
  locationConfidence: 0.8,
  mechanism: "null deref when list is empty",
  mechanismConfidence: 0.7,
  severity: 1.2,
  severityConfidence: 0.6,
  owner: null,
  ownerConfidence: null,
  action: "comment",
  ...over,
});

describe("formatFindings", () => {
  it("says so when there are no findings", () => {
    expect(formatFindings({ findings: [] })).toBe("jev-review: no findings");
  });
  it("lists findings, most severe first, one line each", () => {
    const out = formatFindings({
      findings: [
        finding({}),
        finding({
          file: "src/b.ts",
          line: 3,
          severity: 2.4,
          action: "request_changes",
          mechanism: "secret logged",
          dimension: "security",
        }),
      ],
    });
    expect(out.split("\n")).toEqual([
      "jev-review: 2 findings (prompts, not proof)",
      "  src/b.ts:3 [security, sev 2.4, request_changes] secret logged",
      "  src/a.ts:12 [correctness, sev 1.2, comment] null deref when list is empty",
    ]);
  });
});
