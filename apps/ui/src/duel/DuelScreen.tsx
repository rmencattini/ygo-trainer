import type { CardCatalog, Lang } from "@ygo/cards";
import {
  cardMatchesOpcode,
  describeEffect,
  Phase,
  type DuelSession,
  type Message,
  type Response,
  type TextSource,
} from "@ygo/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardDetails, LANG_NAMES } from "../cards/CardDetails";
import { CardImage, type ImageSource } from "../cards/CardImage";
import { Board, cardKey } from "./Board";
import { engineSources } from "./loadDuel";
import type { CardRef, PromptContext } from "./prompts/context";
import { PromptPanel } from "./prompts/PromptPanel";

const PHASE_NAMES: Record<number, string> = {
  [Phase.DRAW]: "Draw Phase",
  [Phase.STANDBY]: "Standby Phase",
  [Phase.MAIN1]: "Main Phase 1",
  [Phase.BATTLE_START]: "Battle Phase",
  [Phase.BATTLE_STEP]: "Battle Phase",
  [Phase.DAMAGE]: "Damage Step",
  [Phase.DAMAGE_CAL]: "Damage Step",
  [Phase.BATTLE]: "Battle Phase",
  [Phase.MAIN2]: "Main Phase 2",
  [Phase.END]: "End Phase",
};

const CARD_LISTS = [
  "summons",
  "special_summons",
  "pos_changes",
  "monster_sets",
  "spell_sets",
  "activates",
  "attacks",
  "chains",
  "selects",
  "selects_must",
  "select_cards",
  "unselect_cards",
  "cards",
];

/** Board keys of every card the prompt mentions, so the board can highlight them. */
export function promptCards(prompt: Message | null): Set<string> {
  const keys = new Set<string>();
  if (!prompt) return keys;
  for (const list of CARD_LISTS) {
    const cards = (prompt as unknown as Record<string, unknown>)[list];
    if (Array.isArray(cards))
      for (const c of cards as CardRef[]) keys.add(cardKey(c));
  }
  return keys;
}

interface Props {
  session: DuelSession;
  catalog: CardCatalog;
  texts: TextSource;
  images?: ImageSource;
}

const FLAT_KEY = "ygo.flatBoard";

/** Storage can be blocked (private mode, tests); the board then starts tilted. */
function loadFlat(): boolean {
  try {
    return globalThis.localStorage?.getItem(FLAT_KEY) === "1";
  } catch {
    return false;
  }
}

function saveFlat(flat: boolean) {
  try {
    globalThis.localStorage?.setItem(FLAT_KEY, flat ? "1" : "0");
  } catch {
    // Not saved; the choice still holds for this duel.
  }
}

export function DuelScreen({ session, catalog, texts, images }: Props) {
  const [lang, setLang] = useState<Lang>("en");
  const [, setVersion] = useState(0);
  const [focus, setFocus] = useState<CardRef | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [flat, setFlat] = useState(loadFlat);
  // Clicking the table outside a card folds the prompt; a card or a new prompt opens it.
  const [foldedFor, setFoldedFor] = useState<Message | null>(null);
  const folded = foldedFor !== null && foldedFor === session.prompt;
  const setFolded = (fold: boolean) =>
    setFoldedFor(fold ? session.prompt : null);
  const logEnd = useRef<HTMLLIElement>(null);
  const readCard = useMemo(
    () => engineSources(catalog, new Map()).readCard,
    [catalog],
  );

  // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect may only return a cleanup.
  useEffect(() => {
    logEnd.current?.scrollIntoView?.({ block: "nearest" });
  });

  const respond = (response: Response) => {
    session.answer(response);
    setFocus(null);
    setVersion((v) => v + 1);
  };

  // Card names follow the language switch; the log and prompt wording stay English.
  const name = (code: number) =>
    lang === "en"
      ? texts.name(code)
      : (catalog.get(code, lang)?.name ?? texts.name(code));

  const ctx: PromptContext = {
    me: session.human,
    name,
    describe: (d) => describeEffect(d, texts),
    hint: session.hint === null ? null : describeEffect(session.hint, texts),
    images,
    hover: setHovered,
    lastEvent: session.lines.at(-1) ?? null,
    focus,
    announceCandidates: (opcodes, query) =>
      catalog
        .search(query, "en", 200)
        .filter((c) => {
          const data = readCard(c.code);
          return data !== null && cardMatchesOpcode(data, opcodes);
        })
        .map((c) => ({ code: c.code, name: c.name })),
  };

  const { board } = session;
  const whose = board.turnPlayer === session.human ? "Your" : "Opponent's";

  return (
    <div className="duel">
      <aside className="duel__details" aria-label="Card details">
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
        {hovered ? (
          <div className="duel__card">
            {images && (
              <CardImage code={hovered} name={name(hovered)} images={images} />
            )}
            <CardDetails catalog={catalog} code={hovered} lang={lang} />
          </div>
        ) : (
          <p className="duel__hint">Hover a card to read it.</p>
        )}
      </aside>
      <section
        className="duel__table"
        aria-label="Duel table"
        onClick={(e) => {
          if ((e.target as Element).closest("button, select, .prompt")) return;
          setFocus(null);
          setFolded(true);
        }}
      >
        <p className="duel__phase">
          <span>Turn {board.turn}</span> ·{" "}
          <span>
            {whose} {PHASE_NAMES[board.phase] ?? ""}
          </span>
        </p>
        {/* Only the board scrolls, so the corner plates never cover it. */}
        <div className="duel__board">
          <Board
            board={board}
            tilted={!flat}
            me={session.human}
            name={name}
            images={images}
            selectable={promptCards(session.prompt)}
            focus={focus}
            onFocus={(card) => {
              setFocus(focus && cardKey(focus) === cardKey(card) ? null : card);
              setFolded(false);
            }}
            onHover={setHovered}
          />
        </div>
        {session.prompt && (
          <PromptPanel
            prompt={session.prompt}
            ctx={ctx}
            respond={respond}
            folded={folded}
            onUnfold={() => setFolded(false)}
            onFold={() => setFolded(true)}
          />
        )}
        <button
          type="button"
          className="duel__flat"
          aria-pressed={flat}
          onClick={() => {
            setFlat(!flat);
            saveFlat(!flat);
          }}
        >
          Flat board
        </button>
      </section>
      <aside className="duel__side" aria-label="Prompts and log">
        {session.ended && (
          <p className="duel__result" role="status">
            {session.winner === session.human
              ? "You win"
              : session.winner === null
                ? "Draw"
                : "You lose"}
          </p>
        )}
        <h2 className="duel__log-title">Duel log</h2>
        <ol className="duel__log" role="log" aria-label="Duel log">
          {session.lines.map((line, i) => (
            <li
              key={i}
              ref={i === session.lines.length - 1 ? logEnd : undefined}
            >
              {line}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
