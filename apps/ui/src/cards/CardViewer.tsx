import type { CardCatalog, CardView, Lang } from "@ygo/cards";
import { useState } from "react";
import { CardDetails, LANG_NAMES } from "./CardDetails";
import { CardImage, type ImageSource } from "./CardImage";

interface Props {
  catalog: CardCatalog;
  images: ImageSource;
}

const EXTRA = 0x40 | 0x2000 | 0x800000 | 0x4000000; // Fusion, Synchro, Xyz, Link
const KINDS = [
  ["all", "All", () => true],
  ["monster", "Monsters", (c: CardView) => (c.type & 0x1) !== 0],
  ["spell", "Spells", (c: CardView) => (c.type & 0x2) !== 0],
  ["trap", "Traps", (c: CardView) => (c.type & 0x4) !== 0],
  ["extra", "Extra Deck", (c: CardView) => (c.type & EXTRA) !== 0],
] as const;
type Kind = (typeof KINDS)[number][0];

export function CardViewer({ catalog, images }: Props) {
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [selected, setSelected] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const keep = KINDS.find(([k]) => k === kind)![2];
  // Search wide, then filter, so a filter does not empty a page of other kinds.
  const results = query.trim()
    ? catalog.search(query, lang, 400).filter(keep).slice(0, 60)
    : [];
  const card = selected === null ? null : catalog.get(selected, lang);

  // Up / Down in the search box walk the results and show each card.
  const step = (by: number) => {
    if (results.length === 0) return;
    const at = results.findIndex((c) => c.code === selected);
    const next =
      at === -1
        ? by > 0
          ? 0
          : results.length - 1
        : Math.min(Math.max(at + by, 0), results.length - 1);
    setSelected(results[next]!.code);
  };

  return (
    <section className="card-viewer">
      <div className="card-viewer__controls">
        <input
          type="search"
          aria-label="Search cards"
          placeholder="Search a card…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            step(e.key === "ArrowDown" ? 1 : -1);
          }}
        />
        <select
          aria-label="Card text language"
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
        >
          {catalog.languages().map((l) => (
            <option key={l} value={l}>
              {LANG_NAMES[l]}
            </option>
          ))}
        </select>
      </div>
      <div
        role="radiogroup"
        aria-label="Kind of card"
        className="card-viewer__kinds"
      >
        {KINDS.map(([k, label]) => (
          <label key={k} className="chip">
            <input
              type="radio"
              name="kind"
              checked={kind === k}
              onChange={() => setKind(k)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <div className="card-viewer__body">
        <ul className="card-viewer__results">
          {results.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                className="card-tile"
                aria-label={c.name}
                aria-pressed={c.code === selected}
                ref={(el) => {
                  if (el && c.code === selected)
                    el.scrollIntoView?.({ block: "nearest" });
                }}
                onClick={() => setSelected(c.code)}
              >
                <CardImage
                  code={c.code}
                  name=""
                  images={images}
                  className="card-tile__art"
                />
                <span className="card-tile__name">{c.name}</span>
              </button>
            </li>
          ))}
          {query.trim() && results.length === 0 && (
            <li className="card-viewer__none">
              No card matches “{query.trim()}”.
            </li>
          )}
          {!query.trim() && (
            <li className="card-viewer__none">
              Type a card name. Up and Down walk the results.
            </li>
          )}
        </ul>
        {card && (
          <div className="card-viewer__card">
            <CardImage code={card.code} name={card.name} images={images} />
            <CardDetails catalog={catalog} code={card.code} lang={lang} />
          </div>
        )}
      </div>
    </section>
  );
}
