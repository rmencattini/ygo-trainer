import {
  CardCatalog,
  type BaseCard,
  type Lang,
  type LocaleTable,
} from "@ygo/cards";

type Fetch = (url: string) => Promise<Response>;

/** Loads the files written by `npm run cards:export` from `base` (served from `public/`). */
export async function fetchCatalog(
  base = "/cards",
  fetch: Fetch = (url) => globalThis.fetch(url),
) {
  const get = async <T>(file: string): Promise<T> => {
    const response = await fetch(`${base}/${file}`);
    if (!response.ok)
      throw new Error(`Card data missing (${file}). Run: npm run cards:export`);
    return response.json() as Promise<T>;
  };
  const [{ langs }, cards] = await Promise.all([
    get<{ langs: Lang[] }>("index.json"),
    get<BaseCard[]>("en.json"),
  ]);
  const tables = await Promise.all(
    langs.map((lang) => get<LocaleTable>(`${lang}.json`)),
  );
  return new CardCatalog(
    cards,
    Object.fromEntries(langs.map((lang, i) => [lang, tables[i]])),
  );
}
