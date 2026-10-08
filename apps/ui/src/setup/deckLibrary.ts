import {
  isYgoprodeckDeckUrl,
  parseYdk,
  parseYdke,
  parseYgoprodeckPage,
  readYdkMeta,
  type Deck,
} from "@ygo/engine";

export interface DeckEntry {
  id: string;
  name: string;
  kind: "preset" | "test" | "imported";
  deck: Deck;
  source?: string;
}

export interface ImportedDeck {
  name: string;
  deck: Deck;
  source?: string;
}

type Fetch = (url: string) => Promise<Response>;
type PageFetch = (url: string) => Promise<string>;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

const STORAGE_KEY = "ygo-trainer:imported-decks";

/** Presets and test decks written by `npm run cards:export`. */
export async function fetchDeckLibrary(
  fetch: Fetch = (url) => globalThis.fetch(url),
): Promise<DeckEntry[]> {
  const index = await fetch("/decks/index.json");
  if (!index.ok)
    throw new Error("Deck list missing. Run: npm run cards:export");
  const entries = (await index.json()) as {
    file: string;
    name: string;
    preset: boolean;
  }[];
  return Promise.all(
    entries.map(async ({ file, name, preset }) => {
      const text = await (await fetch(`/decks/${file}`)).text();
      return {
        id: file,
        name,
        kind: preset ? ("preset" as const) : ("test" as const),
        deck: parseYdk(text),
        source: readYdkMeta(text).source,
      };
    }),
  );
}

/** YGOProDeck sends no CORS headers: the app fetches through Rust, the dev server through a proxy. */
export async function fetchYgoprodeckPage(url: string): Promise<string> {
  if ("__TAURI_INTERNALS__" in globalThis) {
    const { fetch } = await import("@tauri-apps/plugin-http");
    return (await fetch(url)).text();
  }
  const response = await globalThis.fetch(
    url.replace("https://ygoprodeck.com/deck/", "/ygo-deck/"),
  );
  if (!response.ok) throw new Error(`YGOProDeck answered ${response.status}`);
  return response.text();
}

/** Accepts .ydk text, a ydke:// link or a YGOProDeck deck URL. */
export async function importDeck(
  input: string,
  fileName?: string,
  fetchPage: PageFetch = fetchYgoprodeckPage,
): Promise<ImportedDeck> {
  const text = input.trim();
  if (text.startsWith("ydke://"))
    return { name: "Imported deck", deck: parseYdke(text) };
  if (isYgoprodeckDeckUrl(text)) {
    const { name, deck } = parseYgoprodeckPage(await fetchPage(text));
    return { name, deck, source: text };
  }
  if (/^#main$/m.test(text)) {
    const fallback = fileName?.replace(/\.ydk$/i, "") || "Imported deck";
    return { name: readYdkMeta(text).name ?? fallback, deck: parseYdk(text) };
  }
  throw new Error(
    "Expected a .ydk file, a ydke:// link or a YGOProDeck deck URL",
  );
}

export function loadImported(storage: Storage | null): DeckEntry[] {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DeckEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveImported(
  storage: Storage | null,
  entries: DeckEntry[],
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Private window or blocked storage: the deck stays for this session only.
  }
}
