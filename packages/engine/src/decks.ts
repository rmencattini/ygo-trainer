// Deck formats besides plain .ydk: metadata comments, ydke:// links and YGOProDeck deck pages.
import type { Deck } from "./ydk";

export interface DeckMeta {
  name?: string;
  source?: string;
  event?: string;
}

const META_KEYS = ["name", "source", "event"] as const;

/** Writes a .ydk; name/source/event go in `#key value` comments that other clients ignore. */
export function toYdk(deck: Deck, meta: DeckMeta = {}): string {
  const lines = ["#created by ygo-trainer"];
  for (const key of META_KEYS)
    if (meta[key]) lines.push(`#${key} ${meta[key]}`);
  lines.push(
    "#main",
    ...deck.main.map(String),
    "#extra",
    ...deck.extra.map(String),
    "!side",
    ...deck.side.map(String),
  );
  return lines.join("\n") + "\n";
}

export function readYdkMeta(text: string): DeckMeta {
  const meta: DeckMeta = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^#(name|source|event) (.+)$/.exec(line.trim());
    if (match) meta[match[1] as keyof DeckMeta] = match[2].trim();
  }
  return meta;
}

function decodeCodes(part: string): number[] {
  const bytes = Uint8Array.from(atob(part), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  return Array.from({ length: Math.floor(bytes.length / 4) }, (_, i) =>
    view.getUint32(i * 4, true),
  );
}

/** `ydke://<main>!<extra>!<side>!`, each part base64 of little-endian uint32 passcodes. */
export function parseYdke(url: string): Deck {
  const match = /^ydke:\/\/([^!]*)!([^!]*)!([^!]*)!?$/.exec(url.trim());
  if (!match) throw new Error("not a ydke:// link");
  return {
    main: decodeCodes(match[1]),
    extra: decodeCodes(match[2]),
    side: decodeCodes(match[3]),
  };
}

export function isYgoprodeckDeckUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "ygoprodeck.com" &&
      /^\/deck\/[\w-]+$/.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

/** Reads the deck from a YGOProDeck deck page (it embeds the lists as JS strings). */
export function parseYgoprodeckPage(html: string): {
  name: string;
  deck: Deck;
} {
  const list = (variable: string) => {
    const match = new RegExp(`var ${variable} = '(\\[[^']*\\])'`).exec(html);
    return match ? (JSON.parse(match[1]) as string[]).map(Number) : null;
  };
  const main = list("maindeckjs");
  if (!main) throw new Error("No deck list found on that page");
  const name = /var deckname = "([^"]*)"/.exec(html)?.[1] ?? "Imported deck";
  return {
    name,
    deck: {
      main,
      extra: list("extradeckjs") ?? [],
      side: list("sidedeckjs") ?? [],
    },
  };
}

export interface DeckReport {
  unknown: number[];
  problems: string[];
}

export function validateDeck(
  deck: Deck,
  known: (code: number) => boolean,
): DeckReport {
  const unknown = [
    ...new Set(
      [...deck.main, ...deck.extra, ...deck.side].filter(
        (code) => !known(code),
      ),
    ),
  ];
  const problems: string[] = [];
  if (deck.main.length < 40 || deck.main.length > 60) {
    problems.push(`Main Deck has ${deck.main.length} cards (needs 40 to 60)`);
  }
  if (deck.extra.length > 15)
    problems.push(`Extra Deck has ${deck.extra.length} cards (max 15)`);
  if (unknown.length) {
    problems.push(
      `${unknown.length} card${unknown.length > 1 ? "s" : ""} not in the card database`,
    );
  }
  return { unknown, problems };
}
