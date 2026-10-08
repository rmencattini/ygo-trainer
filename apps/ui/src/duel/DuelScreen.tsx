import type { CardCatalog } from "@ygo/cards";
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
import { CardDetails } from "../cards/CardDetails";
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
}

export function DuelScreen({ session, catalog, texts }: Props) {
  const [, setVersion] = useState(0);
  const [focus, setFocus] = useState<CardRef | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
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

  const ctx: PromptContext = {
    me: session.human,
    name: texts.name,
    describe: (d) => describeEffect(d, texts),
    hint: session.hint === null ? null : describeEffect(session.hint, texts),
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
      <div className="duel__main">
        <p className="duel__status">
          Turn {board.turn} · {whose} {PHASE_NAMES[board.phase] ?? ""}
        </p>
        <Board
          board={board}
          me={session.human}
          name={texts.name}
          selectable={promptCards(session.prompt)}
          focus={focus}
          onFocus={(card) =>
            setFocus(focus && cardKey(focus) === cardKey(card) ? null : card)
          }
          onHover={setHovered}
        />
      </div>
      <aside className="duel__side">
        {session.ended && (
          <p className="duel__result" role="status">
            {session.winner === session.human
              ? "You win"
              : session.winner === null
                ? "Draw"
                : "You lose"}
          </p>
        )}
        {session.prompt && (
          <PromptPanel prompt={session.prompt} ctx={ctx} respond={respond} />
        )}
        <aside className="duel__details" aria-label="Card details">
          {hovered ? (
            <CardDetails catalog={catalog} code={hovered} lang="en" />
          ) : (
            <p>Hover a card to read it.</p>
          )}
        </aside>
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
