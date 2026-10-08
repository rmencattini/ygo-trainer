// Writes the data the UI loads from apps/ui/public:
//   cards/{en,<lang>,index,strings}.json and decks/{*.ydk,index.json}.
// English comes from BabelCDB; other languages from data/locale (npm run cards:locale).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const clean = (text) => text.replace(/[ \t]*\r?\n/g, "\n").trim();
const STR_COLUMNS = Array.from({ length: 16 }, (_, i) => `t.str${i + 1}`).join(
  ", ",
);

function parseStringsConf(text) {
  const out = { system: {}, victory: {}, counter: {}, setname: {} };
  for (const line of text.split(/\r?\n/)) {
    const match = /^!(system|victory|counter|setname) (\S+) (.*)$/.exec(line);
    if (match && Number.isFinite(Number(match[2])))
      out[match[1]][Number(match[2])] = match[3].trim();
  }
  return out;
}

// Effect strings str1..str16 without the empty tail; undefined when there are none.
function effectStrings(row) {
  const list = Array.from({ length: 16 }, (_, i) => row[`str${i + 1}`] ?? "");
  while (list.length && !list[list.length - 1]) list.pop();
  return list.length ? list : undefined;
}

export function exportCards({ cdb, localeDir, out, stringsConf, decksDir }) {
  const db = new DatabaseSync(cdb, { readOnly: true });
  const query = db.prepare(
    `SELECT d.id, d.alias, d.setcode, d.type, d.level, d.attribute, d.race, d.atk, d.def, t.name, t.desc, ${STR_COLUMNS}
     FROM datas d JOIN texts t ON t.id = d.id`,
  );
  query.setReadBigInts(true);
  const rows = query.all().map((row) => ({
    code: Number(row.id),
    alias: Number(row.alias),
    setcode: String(row.setcode),
    type: Number(row.type),
    level: Number(row.level),
    attribute: Number(row.attribute),
    race: Number(row.race),
    atk: Number(row.atk),
    def: Number(row.def),
    name: row.name,
    desc: clean(row.desc),
    strings: effectStrings(row),
  }));
  db.close();
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "en.json"), JSON.stringify(rows));
  writeFileSync(
    join(out, "strings.json"),
    JSON.stringify(parseStringsConf(readFileSync(stringsConf, "utf8"))),
  );

  const decksOut = join(out, "..", "decks");
  mkdirSync(decksOut, { recursive: true });
  const decks = readdirSync(decksDir)
    .filter((file) => file.endsWith(".ydk"))
    .sort();
  for (const deck of decks)
    copyFileSync(join(decksDir, deck), join(decksOut, deck));
  writeFileSync(join(decksOut, "index.json"), JSON.stringify(decks));

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
    stringsConf: join(ROOT, "data", "strings.conf"),
    decksDir: join(ROOT, "data", "decks"),
  });
  console.log(
    `cards:export: ${cards} cards, languages: en${langs.map((l) => `, ${l}`).join("")}`,
  );
}
