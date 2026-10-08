import type { CardCatalog, Lang } from "@ygo/cards";

const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
};

const TYPE_MONSTER = 0x1;
const TYPE_LINK = 0x4000000;

interface Props {
  catalog: CardCatalog;
  code: number;
  lang: Lang;
}

export function CardDetails({ catalog, code, lang }: Props) {
  const card = catalog.get(code, lang);
  if (!card) return <p>Unknown card {code}</p>;
  const isMonster = (card.type & TYPE_MONSTER) !== 0;
  const isLink = (card.type & TYPE_LINK) !== 0;
  return (
    <article lang={card.lang} className="card-details">
      <h2>{card.name}</h2>
      {card.fallback && (
        <p className="card-details__note">
          No {LANG_NAMES[lang]} text yet, showing English.
        </p>
      )}
      {isMonster && (
        <p>
          {isLink ? `ATK ${card.atk}` : `ATK ${card.atk} / DEF ${card.def}`}
        </p>
      )}
      <p style={{ whiteSpace: "pre-line" }}>{card.desc}</p>
    </article>
  );
}
