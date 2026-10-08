// Node-only loaders: the BabelCDB file, locale JSON files and a folder image store.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CardCatalog,
  type BaseCard,
  type Lang,
  type LocaleTable,
} from "./catalog";
import type { ImageStore } from "./images";

export interface CatalogFiles {
  /** Path to BabelCDB `cards.cdb` (English). */
  cdb: string;
  /** Folder of `<lang>.json` files made by `npm run cards:locale`. Missing folder = English only. */
  localeDir: string;
}

const clean = (text: string) => text.replace(/[ \t]*\r?\n/g, "\n").trim();

export function loadCatalog({ cdb, localeDir }: CatalogFiles): CardCatalog {
  const db = new DatabaseSync(cdb, { readOnly: true });
  const rows = db
    .prepare(
      `SELECT d.id, d.alias, d.type, d.level, d.attribute, d.race, d.atk, d.def, t.name, t.desc
       FROM datas d JOIN texts t ON t.id = d.id`,
    )
    .all() as unknown as (Omit<BaseCard, "code"> & { id: number })[];
  db.close();
  const cards: BaseCard[] = rows.map(({ id, ...row }) => ({
    ...row,
    code: id,
    desc: clean(row.desc),
  }));

  const locales: Partial<Record<Lang, LocaleTable>> = {};
  if (existsSync(localeDir)) {
    for (const file of readdirSync(localeDir)) {
      const match = /^(fr|de|it|pt)\.json$/.exec(file);
      if (match)
        locales[match[1] as Lang] = JSON.parse(
          readFileSync(join(localeDir, file), "utf8"),
        );
    }
  }
  return new CardCatalog(cards, locales);
}

const SAFE_KEY = /^\d+(\.small)?\.jpg$/;

export class FsImageStore implements ImageStore {
  constructor(private readonly dir: string) {}

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.path(key)));
    } catch {
      return null;
    }
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const file = this.path(key);
    await mkdir(this.dir, { recursive: true });
    await writeFile(file, bytes);
  }

  private path(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error(`bad image key: ${key}`);
    return join(this.dir, key);
  }
}
