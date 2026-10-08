import { passiveResponse } from "@ygo/ai";
import type { CardCatalog } from "@ygo/cards";
import { DuelSession, Engine, parseYdk, type TextSource } from "@ygo/engine";
import { useState } from "react";
import { DuelScreen } from "./DuelScreen";
import {
  engineSources,
  fetchDeck,
  fetchScripts,
  fetchStrings,
  scriptNames,
  textSource,
} from "./loadDuel";

const TEST_DECK = "m1-vanilla.ydk";

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

/** M3: you go first with the vanilla test deck against a passive opponent. M4 adds deck choice. */
export function TestDuel({ catalog }: { catalog: CardCatalog }) {
  const [state, setState] = useState<{
    session: DuelSession;
    texts: TextSource;
  } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const start = async () => {
    setStatus("Loading the engine…");
    try {
      const deck = parseYdk(await fetchDeck(TEST_DECK));
      const [strings, scripts] = await Promise.all([
        fetchStrings(),
        fetchScripts(scriptNames([deck], catalog)),
      ]);
      const engine = await Engine.create(engineSources(catalog, scripts));
      const texts = textSource(catalog, strings);
      const duel = engine.startDuel({
        seed: seedFromUrl(),
        decks: [deck, deck],
      });
      setState({
        session: new DuelSession(duel, {
          human: 0,
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

  if (state) {
    return (
      <div>
        <button type="button" onClick={() => setState(null)}>
          Leave duel
        </button>
        <DuelScreen
          session={state.session}
          catalog={catalog}
          texts={state.texts}
        />
      </div>
    );
  }
  return (
    <div className="test-duel">
      <p>
        You go first with the vanilla test deck. The opponent passes every turn
        (real AI comes in M5).
      </p>
      <button
        type="button"
        onClick={start}
        disabled={status === "Loading the engine…"}
      >
        Start test duel
      </button>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
