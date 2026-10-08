// Writes the card data the UI loads: apps/ui/public/cards/{en,<lang>,index}.json.
// English comes from BabelCDB; other languages from data/locale (npm run cards:locale).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const clean = (text) => text.replace(/[ \t]*\r?\n/g, "\n").trim();

export function exportCards({ cdb, localeDir, out }) {
  const db = new DatabaseSync(cdb, { readOnly: true });
  const rows = db
    .prepare(
      `SELECT d.id AS code, d.alias, d.type, d.level, d.attribute, d.race, d.atk, d.def, t.name, t.desc
       FROM datas d JOIN texts t ON t.id = d.id`,
    )
    .all();
  db.close();
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, "en.json"),
    JSON.stringify(rows.map((row) => ({ ...row, desc: clean(row.desc) }))),
  );

  const langs = [];
  if (existsSync(localeDir)) {
    for (const file of readdirSync(localeDir).sort()) {
      const match = /^(fr|de|it|pt)\.json$/.exec(file);
      if (!match) continue;
      copyFileSync(join(localeDir, file), join(out, file));
      langs.push(match[1]);
    }
  }
  writeFileSync(join(out, "index.json"), JSON.stringify({ langs }));
  return { cards: rows.length, langs };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { cards, langs } = exportCards({
    cdb: join(ROOT, "data", "cdb", "cards.cdb"),
    localeDir: join(ROOT, "data", "locale"),
    out: join(ROOT, "apps", "ui", "public", "cards"),
  });
  console.log(
    `cards:export: ${cards} cards, languages: en${langs.map((l) => `, ${l}`).join("")}`,
  );
}
