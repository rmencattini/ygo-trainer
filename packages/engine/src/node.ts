// Node-only loaders: card scripts and the card DB read from disk.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { rowToCardData, type CdbRow } from "./cdb";
import { Engine } from "./duel";
import { parseYdk, type Deck } from "./ydk";

// Card scripts live in sub-folders; official cards win over the rest.
const CARD_SCRIPT_DIRS = ["official", "pre-release", "pre-errata", "goat"];

export interface NodeEngineOptions {
  /** Folder holding `scripts/` (ProjectIgnis/CardScripts) and `cdb/` (ProjectIgnis/BabelCDB). */
  dataDir: string;
}

export async function createNodeEngine({
  dataDir,
}: NodeEngineOptions): Promise<Engine> {
  const db = new DatabaseSync(join(dataDir, "cdb", "cards.cdb"), {
    readOnly: true,
  });
  const byId = db.prepare(
    "SELECT id, alias, setcode, type, atk, def, level, race, attribute FROM datas WHERE id = ?",
  );
  byId.setReadBigInts(true);
  const scriptDir = join(dataDir, "scripts");

  return Engine.create({
    readCard(code) {
      const row = byId.get(code) as Record<keyof CdbRow, bigint> | undefined;
      if (!row) return null;
      return rowToCardData({
        id: Number(row.id),
        alias: Number(row.alias),
        setcode: row.setcode,
        type: Number(row.type),
        atk: Number(row.atk),
        def: Number(row.def),
        level: Number(row.level),
        race: row.race,
        attribute: Number(row.attribute),
      });
    },
    readScript(name) {
      const dirs = /^c\d+\.lua$/.test(name) ? CARD_SCRIPT_DIRS : [""];
      for (const dir of dirs) {
        const file = join(scriptDir, dir, name);
        if (existsSync(file)) return readFileSync(file, "utf8");
      }
      return null;
    },
  });
}

export function loadYdk(file: string): Deck {
  return parseYdk(readFileSync(file, "utf8"));
}
