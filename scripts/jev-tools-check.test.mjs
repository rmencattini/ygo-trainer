import { describe, expect, it } from "vitest";
import { report } from "./jev-tools-check.mjs";

const green = {
  saveTokenBuilt: true,
  jevReviewInstalled: true,
  enabledPlugins: {
    "supercov@supercov": true,
    "save-token-jev@ygo-tools": true,
  },
  routerUp: true,
  keyFound: true,
};

describe("report", () => {
  it("prints one line when all is green", () => {
    expect(report(green)).toEqual(["jev tools: all green"]);
  });
  it("prints one line per missing piece", () => {
    const lines = report({
      ...green,
      saveTokenBuilt: false,
      jevReviewInstalled: false,
      routerUp: false,
    });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/save-token-jev.*npm run tools:build/);
    expect(lines[1]).toMatch(/jev-review.*npm run tools:build/);
    expect(lines[2]).toMatch(/router.*127\.0\.0\.1:4000/);
  });
  it("names each disabled plugin", () => {
    const lines = report({
      ...green,
      enabledPlugins: { "supercov@supercov": false },
    });
    expect(lines).toEqual([
      expect.stringMatching(/plugin supercov@supercov not enabled/),
      expect.stringMatching(/plugin save-token-jev@ygo-tools not enabled/),
    ]);
  });
  it("names the key by its variable and Keychain item only", () => {
    const [line] = report({ ...green, keyFound: false });
    expect(line).toMatch(/TYPESAFE_API_KEY/);
    expect(line).toMatch(/typesafe-api-key/);
  });
});
