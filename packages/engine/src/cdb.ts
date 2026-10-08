import type { OcgCardData } from "ocgcore-wasm";

/** One row of the `datas` table in a Project Ignis `.cdb` file. */
export interface CdbRow {
  id: number;
  alias: number;
  setcode: number | bigint;
  type: number;
  atk: number;
  def: number;
  level: number;
  race: number | bigint;
  attribute: number;
}

const TYPE_LINK = 0x4000000;

/** Converts a `datas` row to the card record ocgcore expects. */
export function rowToCardData(row: CdbRow): OcgCardData {
  const setcodes: number[] = [];
  let packed = BigInt(row.setcode);
  while (packed > 0n) {
    const code = Number(packed & 0xffffn);
    if (code) setcodes.push(code);
    packed >>= 16n;
  }
  const isLink = (row.type & TYPE_LINK) !== 0;
  return {
    code: row.id,
    alias: row.alias,
    setcodes,
    type: row.type,
    level: row.level & 0xff,
    attribute: row.attribute,
    race: BigInt(row.race),
    attack: row.atk,
    defense: isLink ? 0 : row.def,
    lscale: (row.level >>> 24) & 0xff,
    rscale: (row.level >>> 16) & 0xff,
    link_marker: isLink ? row.def : 0,
  };
}
