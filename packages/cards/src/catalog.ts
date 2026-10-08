export type Lang = "en" | "fr" | "de" | "it" | "pt";

export interface CardText {
  name: string;
  desc: string;
}

/** Card stats plus English text, as stored in the BabelCDB `.cdb`. */
export interface BaseCard extends CardText {
  code: number;
  /** Passcode of the original card for alternate artworks, else 0. */
  alias: number;
  type: number;
  level: number;
  attribute: number;
  race: number;
  atk: number;
  def: number;
}

/** Card text for one language, keyed by passcode. */
export type LocaleTable = Record<string, CardText>;

export interface CardView extends BaseCard {
  /** Language the text is in. */
  lang: Lang;
  /** True when the asked language had no text and English is shown instead. */
  fallback: boolean;
}

// Lower case, accents removed, so "legendaire" matches "légendaire".
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export class CardCatalog {
  private readonly cards = new Map<number, BaseCard>();

  constructor(
    cards: Iterable<BaseCard>,
    private readonly locales: Partial<Record<Exclude<Lang, "en">, LocaleTable>>,
  ) {
    for (const card of cards) this.cards.set(card.code, card);
  }

  get(code: number, lang: Lang = "en"): CardView | null {
    const card = this.cards.get(code);
    if (!card) return null;
    if (lang === "en") return { ...card, lang, fallback: false };
    const table = this.locales[lang];
    const text =
      table?.[code] ?? (card.alias ? table?.[card.alias] : undefined);
    if (!text) return { ...card, lang: "en", fallback: true };
    return { ...card, name: text.name, desc: text.desc, lang, fallback: false };
  }

  /** Cards whose name contains `query` in `lang`, original artworks only. */
  search(query: string, lang: Lang = "en", limit = 20): CardView[] {
    const needle = fold(query.trim());
    const found: CardView[] = [];
    for (const card of this.cards.values()) {
      if (found.length >= limit) break;
      if (card.alias) continue;
      const view = this.get(card.code, lang);
      if (view && fold(view.name).includes(needle)) found.push(view);
    }
    return found;
  }

  languages(): Lang[] {
    const extra = Object.keys(this.locales).filter(
      (l) => this.locales[l as Exclude<Lang, "en">],
    ) as Lang[];
    return ["en", ...extra];
  }

  all(): BaseCard[] {
    return [...this.cards.values()];
  }
}
