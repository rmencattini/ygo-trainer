import { passiveResponse } from "@ygo/ai";
import type { CardCatalog } from "@ygo/cards";
import { DuelSession, Engine, type TextSource } from "@ygo/engine";
import { useEffect, useState } from "react";
import {
  fetchDeckLibrary,
  importDeck,
  type DeckEntry,
} from "../setup/deckLibrary";
import { DuelSetup, type DuelConfig } from "../setup/DuelSetup";
import { DuelScreen } from "./DuelScreen";
import {
  engineSources,
  fetchScripts,
  fetchStrings,
  scriptNames,
  textSource,
} from "./loadDuel";

/** `?seed=42` replays the same duel; otherwise each duel gets a random seed. */
function seedFromUrl(): [bigint, bigint, bigint, bigint] {
  const fixed = new URLSearchParams(globalThis.location?.search ?? "").get(
    "seed",
  );
  const parts = fixed
    ? [BigInt(fixed), 1n, 2n, 3n]
    : Array.from({ length: 4 }, () =>
        BigInt(Math.floor(Math.random() * 2 ** 32)),
      );
  return parts as [bigint, bigint, bigint, bigint];
}

const storage = (() => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
})();

/** Setup screen, then the duel. The opponent passes every turn until the AI lands (M5). */
export function DuelLauncher({ catalog }: { catalog: CardCatalog }) {
  const [library, setLibrary] = useState<DeckEntry[] | null>(null);
  const [duel, setDuel] = useState<{
    session: DuelSession;
    texts: TextSource;
  } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchDeckLibrary()
      .then(setLibrary)
      .catch((e: Error) => setStatus(e.message));
  }, []);

  const start = async ({ goFirst, mine, theirs }: DuelConfig) => {
    setStatus("Loading the engine…");
    try {
      const [strings, scripts] = await Promise.all([
        fetchStrings(),
        fetchScripts(scriptNames([mine.deck, theirs.deck], catalog)),
      ]);
      const engine = await Engine.create(engineSources(catalog, scripts));
      const texts = textSource(catalog, strings);
      // decks[0] goes first.
      const human = goFirst ? 0 : 1;
      const duel = engine.startDuel({
        seed: seedFromUrl(),
        decks: goFirst ? [mine.deck, theirs.deck] : [theirs.deck, mine.deck],
      });
      if (duel.errors.length) console.warn("Engine errors:", duel.errors);
      setDuel({
        session: new DuelSession(duel, {
          human,
          opponent: passiveResponse,
          texts,
        }),
        texts,
      });
      setStatus(null);
    } catch (error) {
      setStatus(`Could not start the duel: ${(error as Error).message}`);
    }
  };

  if (duel) {
    return (
      <div>
        <button type="button" onClick={() => setDuel(null)}>
          Leave duel
        </button>
        <DuelScreen
          session={duel.session}
          catalog={catalog}
          texts={duel.texts}
        />
      </div>
    );
  }
  return (
    <div>
      <p>The opponent passes every turn for now; the real AI comes in M5.</p>
      {library && (
        <DuelSetup
          library={library}
          known={(code) => catalog.get(code) !== null}
          onStart={start}
          importer={(input, fileName) => importDeck(input, fileName)}
          storage={storage}
        />
      )}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
