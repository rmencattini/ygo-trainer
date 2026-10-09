// Every handtrap rule names a real card with a script, so a typo cannot silently disable it.
import { loadCatalog } from "@ygo/cards/node";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HANDTRAP_RULES } from "../src";

const DATA = join(__dirname, "..", "..", "..", "data");
const catalog = loadCatalog({
  cdb: join(DATA, "cdb", "cards.cdb"),
  localeDir: join(DATA, "missing"),
});

describe("handtrap rules", () => {
  it.each(HANDTRAP_RULES)("$name is a card with a script", (rule) => {
    expect(catalog.get(rule.code)?.name).toBe(rule.name);
    expect(
      existsSync(join(DATA, "scripts", "official", `c${rule.code}.lua`)),
    ).toBe(true);
  });
});
