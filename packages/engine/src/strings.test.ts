import { describe, expect, it } from "vitest";
import { parseStringsConf } from "./strings";

describe("parseStringsConf", () => {
  it("reads system, victory, counter and setname lines", () => {
    const strings = parseStringsConf(
      [
        "# comment",
        "!system 1 Normal Summon",
        "!system 500 Select the card(s) to Tribute",
        "!victory 0x1 LP reached 0",
        "!counter 0x1 Spell Counter",
        "!setname 0x1 Ally of Justice",
        "junk line",
      ].join("\n"),
    );
    expect(strings.system[1]).toBe("Normal Summon");
    expect(strings.system[500]).toBe("Select the card(s) to Tribute");
    expect(strings.victory[1]).toBe("LP reached 0");
    expect(strings.counter[1]).toBe("Spell Counter");
    expect(strings.setname[1]).toBe("Ally of Justice");
  });
});
