// Everything the engine needs in the browser: card data, Lua scripts and English texts.
import type { CardCatalog } from "@ygo/cards";
import {
  rowToCardData,
  type Deck,
  type EngineSources,
  type SystemStrings,
  type TextSource,
} from "@ygo/engine";

type Fetch = (url: string) => Promise<Response>;
const defaultFetch: Fetch = (url) => globalThis.fetch(url);

/** Card scripts to preload: the engine reads scripts synchronously, so they must be in memory first. */
export function scriptNames(decks: Deck[], catalog: CardCatalog): string[] {
  const codes = new Set<number>();
  for (const deck of decks) {
    for (const code of [...deck.main, ...deck.extra]) {
      codes.add(code);
      const alias = catalog.get(code)?.alias;
      if (alias) codes.add(alias);
    }
  }
  return [...codes].map((code) => `official/c${code}.lua`);
}

/** Root helper scripts plus the given card scripts. Missing card scripts (vanilla cards) are skipped. */
export async function fetchScripts(
  cardScripts: string[],
  fetch: Fetch = defaultFetch,
): Promise<Map<string, string>> {
  const index = await fetch("/scripts/index.json");
  if (!index.ok)
    throw new Error(
      "Card scripts are not served at /scripts (see vite-plugin-scripts.ts)",
    );
  const names = [...((await index.json()) as string[]), ...cardScripts];
  const scripts = new Map<string, string>();
  await Promise.all(
    names.map(async (name) => {
      const response = await fetch(`/scripts/${name}`);
      if (response.ok) scripts.set(name, await response.text());
    }),
  );
  return scripts;
}

export function engineSources(
  catalog: CardCatalog,
  scripts: Map<string, string>,
): EngineSources {
  return {
    readCard(code) {
      const card = catalog.get(code);
      if (!card) return null;
      return rowToCardData({
        id: card.code,
        alias: card.alias,
        setcode: BigInt(card.setcode ?? 0),
        type: card.type,
        atk: card.atk,
        def: card.def,
        level: card.level,
        race: card.race,
        attribute: card.attribute,
      });
    },
    readScript(name) {
      const key = /^c\d+\.lua$/.test(name) ? `official/${name}` : name;
      return scripts.get(key) ?? null;
    },
  };
}

/** English texts for the log and prompts (the GUI stays English). */
export function textSource(
  catalog: CardCatalog,
  strings: SystemStrings,
): TextSource {
  return {
    name: (code) => catalog.get(code)?.name ?? `Card ${code}`,
    cardString(code, index) {
      const card = catalog.get(code);
      const own = card?.strings?.[index];
      if (own || !card?.alias) return own || undefined;
      return catalog.get(card.alias)?.strings?.[index] || undefined;
    },
    system: (id) => strings.system[id],
  };
}

export async function fetchStrings(
  fetch: Fetch = defaultFetch,
): Promise<SystemStrings> {
  const response = await fetch("/cards/strings.json");
  if (!response.ok)
    throw new Error("System strings missing. Run: npm run cards:export");
  return response.json();
}

export async function fetchDeck(
  file: string,
  fetch: Fetch = defaultFetch,
): Promise<string> {
  const response = await fetch(`/decks/${file}`);
  if (!response.ok)
    throw new Error(`Deck ${file} missing. Run: npm run cards:export`);
  return response.text();
}
