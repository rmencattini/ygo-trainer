import { describe, expect, it } from "vitest";
import { parseYdk } from "./ydk";

describe("parseYdk", () => {
  it("splits main, extra and side", () => {
    const deck = parseYdk(
      [
        "#created by someone",
        "#main",
        "111",
        "222",
        "#extra",
        "333",
        "!side",
        "444",
      ].join("\n"),
    );
    expect(deck).toEqual({ main: [111, 222], extra: [333], side: [444] });
  });

  it("ignores blank lines, CRLF and comments", () => {
    const deck = parseYdk(
      "#main\r\n111\r\n\r\n# note\r\n222\r\n#extra\r\n!side\r\n",
    );
    expect(deck).toEqual({ main: [111, 222], extra: [], side: [] });
  });

  it("rejects a line that is not a passcode", () => {
    expect(() => parseYdk("#main\nabc\n")).toThrow(/line 2/);
  });
});
