import {
  CardLocation,
  type Board as BoardState,
  type CardInfo,
  type PlayerBoard,
} from "@ygo/engine";
import type { CSSProperties } from "react";
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
  /** Lean the field back in 3D, like a real table. */
  tilted?: boolean;
}

export const cardKey = (c: CardRef) =>
  `${c.controller}-${c.location}-${c.sequence}`;

/**
 * Each field is a 7×3 grid. Seen from your seat:
 *   row 1  ·  ·  EMZ ·  EMZ ·  Banished      (shared with the opponent's row 3)
 *   row 2  Field  M1 M2 M3 M4 M5  GY
 *   row 3  Extra  S1 S2 S3 S4 S5  Deck
 * The opponent's grid is the same turned around: rows 3-2-1, columns 7…1.
 */
type Place = { column: number; row: number };
const place = (mine: boolean, column: number, row: number): CSSProperties =>
  mine
    ? { gridColumn: `${column}`, gridRow: `${row}` }
    : { gridColumn: `${8 - column}`, gridRow: `${4 - row}` };

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

type CardProps = { card: CardInfo; at: CardRef; mine: boolean } & Omit<
  Props,
  "board" | "me" | "tilted"
>;

function Card(props: CardProps & { style?: CSSProperties }) {
  const { card, at, mine, style } = props;
  const zone = zoneLabel(at.location, at.sequence);
  if (!card)
    return <div className="zone" style={style} aria-label={`Empty ${zone}`} />;
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
      style={style}
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

/** A stack drawn in its zone; GY and Banished show their top card face-up. */
function Pile({
  label,
  count,
  cards,
  faceUp,
  style,
  name,
  images,
}: {
  label: string;
  count: number;
  cards?: CardInfo[];
  faceUp?: boolean;
  style: CSSProperties;
  name(code: number): string;
  images?: ImageSource;
}) {
  const names = cards?.map((c) => (c?.code ? name(c.code) : "?")).join(", ");
  const top = faceUp ? cards?.at(-1)?.code : undefined;
  return (
    <div
      className={`pile ${count === 0 ? "pile--empty" : ""} ${faceUp ? "" : "pile--back"}`}
      style={style}
      title={cards && count ? `${label}: ${names}` : label}
    >
      {top && images ? (
        <CardImage
          code={top}
          name={name(top)}
          images={images}
          className="pile__top"
        />
      ) : null}
      <span className="pile__label">
        {label} {count}
      </span>
    </div>
  );
}

function Side({
  player,
  side,
  mine,
  coveredEmz,
  ...rest
}: {
  player: 0 | 1;
  side: PlayerBoard;
  mine: boolean;
  /** Our Extra Monster Zones the opponent sits in (5 = left, 6 = right). */
  coveredEmz: Set<number>;
} & Omit<Props, "board" | "me" | "tilted">) {
  const cell = (
    card: CardInfo,
    location: number,
    sequence: number,
    at: Place,
  ) => (
    <Card
      key={`${location}-${sequence}`}
      card={card}
      at={{ controller: player, location, sequence }}
      mine={mine}
      style={place(mine, at.column, at.row)}
      {...rest}
    />
  );
  const emz = [5, 6].map((seq) => {
    const card = side.monsters[seq] ?? null;
    // The Extra Monster Zones are shared: draw each empty one once, on our side.
    if (!card && (!mine || coveredEmz.has(seq))) return null;
    return cell(card, CardLocation.MZONE, seq, {
      column: seq === 5 ? 3 : 5,
      row: 1,
    });
  });
  const hand = side.hand.map((c, i) => (
    <Card
      key={`hand-${i}`}
      card={c}
      at={{ controller: player, location: CardLocation.HAND, sequence: i }}
      mine={mine}
      style={
        {
          "--fan": i - (side.hand.length - 1) / 2,
        } as CSSProperties
      }
      {...rest}
    />
  ));
  const piles = { name: rest.name, images: rest.images };

  return (
    <section
      className={`side ${mine ? "side--mine" : "side--theirs"}`}
      aria-label={mine ? "Your field" : "Opponent's field"}
    >
      <div
        className={`lp-plate lp-plate--${mine ? "mine" : "theirs"}`}
        role="group"
        aria-label={mine ? "Your life points" : "Opponent's life points"}
      >
        <span className="lp-plate__who">{mine ? "You" : "AI"}</span>
        <strong className="lp-plate__lp">LP {side.lp}</strong>
      </div>
      <div className={`hand hand--${mine ? "mine" : "theirs"}`}>{hand}</div>
      <div className={`field field--${mine ? "mine" : "theirs"}`}>
        {emz}
        <Pile
          label="Banished"
          count={side.banished.length}
          cards={side.banished}
          faceUp
          style={place(mine, 7, 1)}
          {...piles}
        />
        {side.monsters
          .slice(0, 5)
          .map((c, i) =>
            cell(c, CardLocation.MZONE, i, { column: i + 2, row: 2 }),
          )}
        {cell(side.spells[5] ?? null, CardLocation.SZONE, 5, {
          column: 1,
          row: 2,
        })}
        <Pile
          label="GY"
          count={side.grave.length}
          cards={side.grave}
          faceUp
          style={place(mine, 7, 2)}
          {...piles}
        />
        {side.spells
          .slice(0, 5)
          .map((c, i) =>
            cell(c, CardLocation.SZONE, i, { column: i + 2, row: 3 }),
          )}
        <Pile
          label="Extra"
          count={side.extra.length}
          style={place(mine, 1, 3)}
          {...piles}
        />
        <Pile
          label="Deck"
          count={side.deck}
          style={place(mine, 7, 3)}
          {...piles}
        />
      </div>
    </section>
  );
}

export function Board({ board, me, tilted, ...rest }: Props) {
  const them = (1 - me) as 0 | 1;
  // Their right Extra Monster Zone (6) is our left (5), and the other way round.
  const covered = new Set(
    [5, 6].filter((seq) => board.players[them].monsters[11 - seq]),
  );
  return (
    <div className={`board ${tilted ? "board--tilted" : ""}`}>
      <Side
        player={them}
        side={board.players[them]}
        mine={false}
        coveredEmz={new Set()}
        {...rest}
      />
      <Side
        player={me}
        side={board.players[me]}
        mine
        coveredEmz={covered}
        {...rest}
      />
    </div>
  );
}
