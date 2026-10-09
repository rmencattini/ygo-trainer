import { validateDeck } from "@ygo/engine";
import { useState } from "react";
import { CardImage, type ImageSource } from "../cards/CardImage";
import {
  loadImported,
  saveImported,
  type DeckEntry,
  type ImportedDeck,
} from "./deckLibrary";

export interface DuelConfig {
  goFirst: boolean;
  mine: DeckEntry;
  theirs: DeckEntry;
}

interface Props {
  library: DeckEntry[];
  /** Whether a passcode is in the card DB. */
  known(code: number): boolean;
  onStart(config: DuelConfig): void;
  importer(input: string, fileName?: string): Promise<ImportedDeck>;
  /** Where imported decks are kept between sessions; null keeps them in memory only. */
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  /** Card art for deck covers; without it tiles show names only. */
  images?: ImageSource;
}

const GROUPS: [DeckEntry["kind"], string][] = [
  ["preset", "Tournament presets"],
  ["imported", "Imported"],
  ["test", "Test decks"],
];

/** A deck's face: the first card of its Main Deck (Extra Deck if the main is empty). */
const coverOf = (d: DeckEntry) => d.deck.main[0] ?? d.deck.extra[0];

function Cover(props: {
  deck: DeckEntry;
  images?: ImageSource;
  className: string;
}) {
  const code = coverOf(props.deck);
  return (
    <span className={props.className} aria-hidden="true">
      {props.images && code !== undefined && (
        <CardImage
          code={code}
          name=""
          images={props.images}
          className={`${props.className}-img`}
        />
      )}
    </span>
  );
}

function DeckPicker(props: {
  label: string;
  /** Radio group name, unique per picker. */
  group: string;
  decks: DeckEntry[];
  value: string;
  onChange(id: string): void;
  known(code: number): boolean;
  images?: ImageSource;
}) {
  const selected = props.decks.find((d) => d.id === props.value);
  const problems = selected
    ? validateDeck(selected.deck, props.known).problems
    : [];
  return (
    <div className="setup__deck">
      {selected && (
        <div className="deck-hero">
          <Cover
            deck={selected}
            images={props.images}
            className="deck-hero__art"
          />
          <div className="deck-hero__info">
            <strong className="deck-hero__name">{selected.name}</strong>
            <span className="deck-hero__meta">
              <span>Main {selected.deck.main.length}</span>
              <span>Extra {selected.deck.extra.length}</span>
              <span>Side {selected.deck.side.length}</span>
              {selected.source && (
                <a href={selected.source} target="_blank" rel="noreferrer">
                  List source
                </a>
              )}
            </span>
          </div>
        </div>
      )}
      {problems.map((p) => (
        <p key={p} className="setup__warning">
          {p}
        </p>
      ))}
      <div role="radiogroup" aria-label={props.label} className="deck-picker">
        {GROUPS.map(([kind, title]) => {
          const decks = props.decks.filter((d) => d.kind === kind);
          return (
            decks.length > 0 && (
              <div key={kind} className="deck-picker__group">
                <h4>{title}</h4>
                <div className="deck-picker__tiles">
                  {decks.map((d) => (
                    <label
                      key={d.id}
                      className={`deck-tile ${d.id === props.value ? "deck-tile--on" : ""}`}
                    >
                      <input
                        type="radio"
                        name={props.group}
                        checked={d.id === props.value}
                        onChange={() => props.onChange(d.id)}
                      />
                      <Cover
                        deck={d}
                        images={props.images}
                        className="deck-tile__art"
                      />
                      <span className="deck-tile__name">
                        {d.name} ({d.deck.main.length})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          );
        })}
      </div>
    </div>
  );
}

export function DuelSetup({
  library,
  known,
  onStart,
  importer,
  storage,
  images,
}: Props) {
  const [imported, setImported] = useState<DeckEntry[]>(() =>
    loadImported(storage),
  );
  const decks = [...library, ...imported];
  const [goFirst, setGoFirst] = useState(true);
  const [mine, setMine] = useState(decks[0]?.id ?? "");
  const [theirs, setTheirs] = useState(decks[0]?.id ?? "");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addImport = async (input: string, fileName?: string) => {
    setError(null);
    setBusy(true);
    try {
      const result = await (fileName === undefined
        ? importer(input)
        : importer(input, fileName));
      const entry: DeckEntry = {
        ...result,
        id: `imported:${Date.now()}`,
        kind: "imported",
      };
      const next = [...imported, entry];
      setImported(next);
      saveImported(storage, next);
      setMine(entry.id);
      setLink("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const byId = (id: string) => decks.find((d) => d.id === id)!;

  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault();
        onStart({ goFirst, mine: byId(mine), theirs: byId(theirs) });
      }}
    >
      <header className="setup__title">
        <h2>New duel</h2>
        <p>Pick both decks and who starts. The AI plays the other side.</p>
      </header>
      <div className="setup__grid">
        <section className="setup__side setup__side--mine" aria-label="You">
          <div className="setup__who">
            <span className="setup__avatar">You</span>
            <h3>You</h3>
          </div>
          <DeckPicker
            label="Your deck"
            group="mine"
            decks={decks}
            value={mine}
            onChange={setMine}
            known={known}
            images={images}
          />
          <details className="setup__import">
            <summary>Import a deck</summary>
            <label className="setup__file">
              Import a .ydk file
              <input
                type="file"
                accept=".ydk"
                aria-label="Import a .ydk file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await addImport(await file.text(), file.name);
                  e.target.value = "";
                }}
              />
            </label>
            <div className="setup__link">
              <input
                aria-label="Deck link"
                placeholder="ydke://… or https://ygoprodeck.com/deck/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
              <button
                type="button"
                disabled={!link.trim() || busy}
                onClick={() => addImport(link)}
              >
                Import link
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
          </details>
        </section>
        <div className="setup__mid">
          <div className="setup__vs" aria-hidden="true">
            VS
          </div>
          <fieldset className="setup__first">
            <legend>Who goes first</legend>
            <label>
              <input
                type="radio"
                name="turn"
                aria-label="I go first"
                checked={goFirst}
                onChange={() => setGoFirst(true)}
              />
              <span>
                I go first
                <small>Practise your combo</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="turn"
                aria-label="I go second"
                checked={!goFirst}
                onChange={() => setGoFirst(false)}
              />
              <span>
                I go second
                <small>Practise handtraps</small>
              </span>
            </label>
          </fieldset>
          <button
            type="submit"
            className="setup__start"
            disabled={!mine || !theirs}
          >
            Start duel
          </button>
        </div>
        <section
          className="setup__side setup__side--theirs"
          aria-label="AI opponent"
        >
          <div className="setup__who">
            <span className="setup__avatar">AI</span>
            <h3>AI opponent</h3>
          </div>
          <DeckPicker
            label="Opponent's deck"
            group="theirs"
            decks={decks}
            value={theirs}
            onChange={setTheirs}
            known={known}
            images={images}
          />
        </section>
      </div>
    </form>
  );
}
