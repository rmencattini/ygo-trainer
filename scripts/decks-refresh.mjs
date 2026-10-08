// Pulls recent "Tournament Meta Decks" from YGOProDeck and writes the most played archetypes
// to data/decks/presets/*.ydk. Review the diff before committing: lists go out of date.
// Usage: npm run decks:refresh [-- <count, default 6>]
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const API =
  "https://ygoprodeck.com/api/decks/getDecks.php?format=Tournament%20Meta%20Decks&limit=20";
const PAGES = 5;
const OUT = join(import.meta.dirname, "..", "data", "decks", "presets");

export const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** "Winner" beats "Top 4" beats "Top 32"; unknown placements rank last. */
function placementRank(placement = "") {
  if (/winner|1st/i.test(placement)) return 1;
  if (/2nd|finalist/i.test(placement)) return 2;
  const top = /top\s*(\d+)/i.exec(placement);
  return top ? Number(top[1]) : 999;
}

const codes = (json) => (json ? JSON.parse(json).map(Number) : []);

/** The `count` most played archetypes, each with its best placed (then newest) list. */
export function pickPresets(lists, count) {
  const byName = new Map();
  for (const list of lists) {
    const group = byName.get(list.deck_name) ?? [];
    group.push(list);
    byName.set(list.deck_name, group);
  }
  return [...byName.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, count)
    .map(([name, group]) => {
      const best = [...group].sort(
        (a, b) =>
          placementRank(a.tournamentPlacement) -
            placementRank(b.tournamentPlacement) || b.deckNum - a.deckNum,
      )[0];
      return {
        name,
        file: `${slugify(name)}.ydk`,
        source: `https://ygoprodeck.com/deck/${best.pretty_url}`,
        event: [best.tournamentName, best.tournamentPlacement]
          .filter(Boolean)
          .join(", "),
        deck: {
          main: codes(best.main_deck),
          extra: codes(best.extra_deck),
          side: codes(best.side_deck),
        },
      };
    });
}

function toYdk({ deck, name, source, event }) {
  return (
    [
      "#created by ygo-trainer decks:refresh",
      `#name ${name}`,
      `#source ${source}`,
      `#event ${event}`,
      "#main",
      ...deck.main,
      "#extra",
      ...deck.extra,
      "!side",
      ...deck.side,
    ].join("\n") + "\n"
  );
}

async function main(count) {
  const lists = [];
  for (let page = 0; page < PAGES; page++) {
    const response = await fetch(`${API}&offset=${page * 20}`);
    if (!response.ok) throw new Error(`YGOProDeck answered ${response.status}`);
    lists.push(...(await response.json()));
  }
  const presets = pickPresets(lists, count);
  mkdirSync(OUT, { recursive: true });
  for (const old of readdirSync(OUT).filter((f) => f.endsWith(".ydk")))
    rmSync(join(OUT, old));
  for (const preset of presets)
    writeFileSync(join(OUT, preset.file), toYdk(preset));
  console.log(
    `decks:refresh: ${lists.length} lists -> ${presets.length} presets`,
  );
  for (const p of presets) console.log(`  ${p.name} (${p.event}) ${p.source}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(Number(process.argv[2] ?? 6)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
