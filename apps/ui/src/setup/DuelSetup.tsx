import { validateDeck } from "@ygo/engine";
import { useState } from "react";
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
}

const GROUPS: [DeckEntry["kind"], string][] = [
  ["preset", "Tournament presets"],
  ["imported", "Imported"],
  ["test", "Test decks"],
];

function DeckPicker(props: {
  label: string;
  decks: DeckEntry[];
  value: string;
  onChange(id: string): void;
  known(code: number): boolean;
}) {
  const selected = props.decks.find((d) => d.id === props.value);
  const problems = selected
    ? validateDeck(selected.deck, props.known).problems
    : [];
  return (
    <div className="setup__deck">
      <label>
        {props.label}
        <select
          aria-label={props.label}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        >
          {GROUPS.map(([kind, title]) => {
            const decks = props.decks.filter((d) => d.kind === kind);
            return (
              decks.length > 0 && (
                <optgroup key={kind} label={title}>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.deck.main.length})
                    </option>
                  ))}
                </optgroup>
              )
            );
          })}
        </select>
      </label>
      {selected?.source && (
        <a href={selected.source} target="_blank" rel="noreferrer">
          List source
        </a>
      )}
      {problems.map((p) => (
        <p key={p} className="setup__warning">
          {p}
        </p>
      ))}
    </div>
  );
}

export function DuelSetup({
  library,
  known,
  onStart,
  importer,
  storage,
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
      <fieldset>
        <legend>Who goes first</legend>
        <label>
          <input
            type="radio"
            name="turn"
            checked={goFirst}
            onChange={() => setGoFirst(true)}
          />{" "}
          I go first
        </label>
        <label>
          <input
            type="radio"
            name="turn"
            checked={!goFirst}
            onChange={() => setGoFirst(false)}
          />{" "}
          I go second
        </label>
      </fieldset>
      <DeckPicker
        label="Your deck"
        decks={decks}
        value={mine}
        onChange={setMine}
        known={known}
      />
      <DeckPicker
        label="Opponent's deck"
        decks={decks}
        value={theirs}
        onChange={setTheirs}
        known={known}
      />
      <fieldset>
        <legend>Import a deck</legend>
        <label>
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
      </fieldset>
      <button type="submit" disabled={!mine || !theirs}>
        Start duel
      </button>
    </form>
  );
}
