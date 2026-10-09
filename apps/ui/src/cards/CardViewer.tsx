import type { CardCatalog, Lang } from "@ygo/cards";
import { useState } from "react";
import { CardDetails, LANG_NAMES } from "./CardDetails";
import { CardImage, type ImageSource } from "./CardImage";

interface Props {
  catalog: CardCatalog;
  images: ImageSource;
}

export function CardViewer({ catalog, images }: Props) {
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<Lang>("en");
  const [selected, setSelected] = useState<number | null>(null);
  const results = query.trim() ? catalog.search(query, lang, 30) : [];
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
      <div className="card-viewer__body">
        <ul className="card-viewer__results">
          {results.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                aria-pressed={c.code === selected}
                ref={(el) => {
                  if (el && c.code === selected)
                    el.scrollIntoView?.({ block: "nearest" });
                }}
                onClick={() => setSelected(c.code)}
              >
                {c.name}
              </button>
            </li>
          ))}
          {query.trim() && results.length === 0 && (
            <li>No card matches “{query.trim()}”.</li>
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
