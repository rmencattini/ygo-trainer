import {
  CardLocation,
  type Board as BoardState,
  type CardInfo,
  type PlayerBoard,
} from "@ygo/engine";
import { CardImage, type ImageSource } from "../cards/CardImage";
import type { CardRef } from "./prompts/context";

const FACEDOWN = 0xa;
const DEFENSE = 0xc;

interface Props {
  board: BoardState;
  me: 0 | 1;
  name(code: number): string;
  /** Card art for face-up cards; without it cards show their name only. */
  images?: ImageSource;
  /** `${controller}-${location}-${sequence}` of cards the current prompt uses. */
  selectable: Set<string>;
  focus: CardRef | null;
  onFocus(card: CardRef): void;
  onHover(code: number): void;
}

export const cardKey = (c: CardRef) =>
  `${c.controller}-${c.location}-${c.sequence}`;

function zoneLabel(location: number, sequence: number): string {
  if (location === CardLocation.HAND) return "hand";
  if (location === CardLocation.MZONE) {
    return sequence < 5
      ? `Monster Zone ${sequence + 1}`
      : `Extra Monster Zone ${sequence === 5 ? "left" : "right"}`;
  }
  if (sequence < 5) return `Spell & Trap Zone ${sequence + 1}`;
  return sequence === 5
    ? "Field Zone"
    : `Pendulum Zone ${sequence === 6 ? "left" : "right"}`;
}

function Card(
  props: { card: CardInfo; at: CardRef; mine: boolean } & Omit<
    Props,
    "board" | "me"
  >,
) {
  const { card, at, mine } = props;
  const zone = zoneLabel(at.location, at.sequence);
  if (!card) return <div className="zone" aria-label={`Empty ${zone}`} />;
  // The engine marks every hand card face-down; only field cards can be set.
  const faceDown =
    at.location !== CardLocation.HAND &&
    ((card.position ?? 0) & FACEDOWN) !== 0;
  const hidden = !mine && (faceDown || at.location === CardLocation.HAND);
  const name = hidden ? "Face-down card" : props.name(card.code ?? 0);
  const stats =
    at.location === CardLocation.MZONE && !hidden && !faceDown
      ? `, ATK ${card.attack}`
      : "";
  const key = cardKey(at);
  const selectable = props.selectable.has(key);
  const focused = props.focus && cardKey(props.focus) === key;
  const classes = [
    "card",
    hidden ? "card--back" : "",
    faceDown ? "card--set" : "",
    ((card.position ?? 0) & DEFENSE) !== 0 && at.location === CardLocation.MZONE
      ? "card--defense"
      : "",
    selectable ? "card--selectable" : "",
    focused ? "card--focused" : "",
  ];
  return (
    <button
      type="button"
      className={classes.filter(Boolean).join(" ")}
      aria-label={`${name}, ${zone}${stats}`}
      onClick={() => selectable && props.onFocus(at)}
      onMouseEnter={() => !hidden && card.code && props.onHover(card.code)}
    >
      {props.images && !hidden && !faceDown && card.code ? (
        <CardImage
          code={card.code}
          name={name}
          images={props.images}
          className="card__art"
        />
      ) : null}
      <span className="card__name">{name}</span>
      {stats && <span className="card__stats">{card.attack}</span>}
    </button>
  );
}

function Pile({
  label,
  cards,
  name,
}: {
  label: string;
  cards: CardInfo[];
  name(code: number): string;
}) {
  const names = cards.map((c) => (c?.code ? name(c.code) : "?")).join(", ");
  return (
    <div className="pile" title={cards.length ? `${label}: ${names}` : label}>
      {label} {cards.length}
    </div>
  );
}

function Side({
  player,
  side,
  mine,
  ...rest
}: { player: 0 | 1; side: PlayerBoard; mine: boolean } & Omit<
  Props,
  "board" | "me"
>) {
  const cell = (card: CardInfo, location: number, sequence: number) => (
    <Card
      key={`${location}-${sequence}`}
      card={card}
      at={{ controller: player, location, sequence }}
      mine={mine}
      {...rest}
    />
  );
  return (
    <section
      className={`side ${mine ? "side--mine" : "side--theirs"}`}
      aria-label={mine ? "Your field" : "Opponent's field"}
    >
      <div className="side__info">
        <strong>LP {side.lp}</strong>
        <div className="pile">Deck {side.deck}</div>
        <Pile label="GY" cards={side.grave} name={rest.name} />
        <Pile label="Banished" cards={side.banished} name={rest.name} />
        <div className="pile">Extra {side.extra.length}</div>
      </div>
      <div className="side__rows">
        <div className="row row--emz">
          {side.monsters
            .slice(5, 7)
            .map((c, i) => cell(c, CardLocation.MZONE, i + 5))}
        </div>
        <div className="row">
          {side.monsters
            .slice(0, 5)
            .map((c, i) => cell(c, CardLocation.MZONE, i))}
        </div>
        <div className="row">
          {side.spells
            .slice(0, 6)
            .map((c, i) => cell(c, CardLocation.SZONE, i))}
        </div>
        <div className="row row--hand">
          {side.hand.map((c, i) => cell(c, CardLocation.HAND, i))}
        </div>
      </div>
    </section>
  );
}

export function Board({ board, me, ...rest }: Props) {
  const them = (1 - me) as 0 | 1;
  return (
    <div className="board">
      <Side player={them} side={board.players[them]} mine={false} {...rest} />
      <Side player={me} side={board.players[me]} mine {...rest} />
    </div>
  );
}
