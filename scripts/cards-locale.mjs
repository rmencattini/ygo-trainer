// Builds data/locale/<lang>.json (passcode -> name + text) from the YGOProDeck API.
// Usage: npm run cards:locale -- fr
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LANGS = ["fr", "de", "it", "pt"];
const API = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

/** Turns a YGOProDeck `cardinfo.php` reply into a locale table. */
export function toLocaleTable(api) {
  const table = {};
  for (const card of api.data) {
    if (!card.name) continue;
    table[card.id] = {
      name: card.name,
      desc: (card.desc ?? "").replace(/[ \t]*\r?\n/g, "\n").trim(),
    };
  }
  return table;
}

async function main(lang) {
  if (!LANGS.includes(lang))
    throw new Error(`language must be one of ${LANGS.join(", ")}`);
  const response = await fetch(`${API}?language=${lang}`);
  if (!response.ok) throw new Error(`YGOProDeck answered ${response.status}`);
  const table = toLocaleTable(await response.json());
  const out = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "data",
    "locale",
    `${lang}.json`,
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(table));
  console.log(`${Object.keys(table).length} cards -> ${out}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
