// Prompts where you pick cards: select, tribute, select/unselect, counters, sums, sorting.
import {
  ResponseType,
  type OcgMessageSelectCard,
  type OcgMessageSelectCounter,
  type OcgMessageSelectSum,
  type OcgMessageSelectTribute,
  type OcgMessageSelectUnselectCard,
  type OcgMessageSortCard,
  type OcgMessageSortChain,
} from "@ygo/engine";
import { useState } from "react";
import { CardImage, type ImageSource } from "../../cards/CardImage";
import type { PromptProps } from "./context";
import { whereLabel } from "./labels";

const toggle = (list: number[], i: number) =>
  list.includes(i)
    ? list.filter((x) => x !== i)
    : [...list, i].sort((a, b) => a - b);

interface Pickable {
  code: number;
  controller: 0 | 1;
  location: number;
}

/** A card you can pick, drawn with its art when there is some. */
function CardChoice(props: {
  code: number;
  label: string;
  images?: ImageSource;
  pressed?: boolean;
  disabled?: boolean;
  title?: string;
  onClick(): void;
  onHover?(code: number): void;
}) {
  return (
    <button
      type="button"
      className="pick"
      onMouseEnter={() => props.onHover?.(props.code)}
      aria-label={props.label}
      aria-pressed={props.pressed}
      disabled={props.disabled}
      title={props.title}
      onClick={props.onClick}
    >
      {props.images && (
        <CardImage
          code={props.code}
          name={props.label}
          images={props.images}
          className="pick__art"
        />
      )}
      <span className="pick__name">{props.label}</span>
    </button>
  );
}

function PickList(props: {
  cards: Pickable[];
  picked: number[];
  label?: (i: number) => string;
  onToggle(i: number): void;
  me: number;
  name(code: number): string;
  images?: ImageSource;
  onHover?(code: number): void;
  locked?: number[];
}) {
  return (
    <ul className="prompt__cards">
      {props.cards.map((c, i) => (
        <li key={i}>
          <CardChoice
            code={c.code}
            label={props.label ? props.label(i) : props.name(c.code)}
            images={props.images}
            pressed={props.picked.includes(i)}
            disabled={props.locked?.includes(i)}
            title={whereLabel(c.controller, c.location, props.me)}
            onClick={() => props.onToggle(i)}
            onHover={props.onHover}
          />
        </li>
      ))}
    </ul>
  );
}

function ConfirmRow({
  ok,
  onConfirm,
  onCancel,
}: {
  ok: boolean;
  onConfirm(): void;
  onCancel?: () => void;
}) {
  return (
    <div className="prompt__actions">
      <button type="button" disabled={!ok} onClick={onConfirm}>
        Confirm
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

export function SelectCardPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectCard>) {
  const [picked, setPicked] = useState<number[]>([]);
  const ok = picked.length >= prompt.min && picked.length <= prompt.max;
  return (
    <div>
      <p>
        Pick{" "}
        {prompt.min === prompt.max
          ? prompt.min
          : `${prompt.min} to ${prompt.max}`}{" "}
        card{prompt.max > 1 ? "s" : ""}
      </p>
      <PickList
        cards={prompt.selects}
        picked={picked}
        onToggle={(i) => setPicked(toggle(picked, i))}
        me={ctx.me}
        name={ctx.name}
        images={ctx.images}
        onHover={ctx.hover}
      />
      <ConfirmRow
        ok={ok}
        onConfirm={() =>
          respond({ type: ResponseType.SELECT_CARD, indicies: picked })
        }
        onCancel={
          prompt.can_cancel
            ? () => respond({ type: ResponseType.SELECT_CARD, indicies: null })
            : undefined
        }
      />
    </div>
  );
}

/** min/max count tributes; a card's release_param says how many tributes it is worth. */
export function TributePrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectTribute>) {
  const [picked, setPicked] = useState<number[]>([]);
  const total = picked.reduce(
    (sum, i) => sum + prompt.selects[i].release_param,
    0,
  );
  const ok = total >= prompt.min && total <= prompt.max;
  return (
    <div>
      <p>
        Tribute{" "}
        {prompt.min === prompt.max
          ? prompt.min
          : `${prompt.min} to ${prompt.max}`}{" "}
        (chosen: {total})
      </p>
      <PickList
        cards={prompt.selects}
        picked={picked}
        onToggle={(i) => setPicked(toggle(picked, i))}
        me={ctx.me}
        name={ctx.name}
        images={ctx.images}
        onHover={ctx.hover}
      />
      <ConfirmRow
        ok={ok}
        onConfirm={() =>
          respond({ type: ResponseType.SELECT_TRIBUTE, indicies: picked })
        }
        onCancel={
          prompt.can_cancel
            ? () =>
                respond({ type: ResponseType.SELECT_TRIBUTE, indicies: null })
            : undefined
        }
      />
    </div>
  );
}

/** One card per answer; indices cover select_cards first, then unselect_cards. */
export function UnselectCardPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectUnselectCard>) {
  const send = (index: number | null) =>
    respond({ type: ResponseType.SELECT_UNSELECT_CARD, index });
  return (
    <div>
      <ul className="prompt__cards">
        {prompt.select_cards.map((c, i) => (
          <li key={`s${i}`}>
            <CardChoice
              code={c.code}
              label={`Pick ${ctx.name(c.code)}`}
              images={ctx.images}
              onHover={ctx.hover}
              onClick={() => send(i)}
            />
          </li>
        ))}
        {prompt.unselect_cards.map((c, i) => (
          <li key={`u${i}`}>
            <CardChoice
              code={c.code}
              label={`Drop ${ctx.name(c.code)}`}
              images={ctx.images}
              onHover={ctx.hover}
              pressed
              onClick={() => send(prompt.select_cards.length + i)}
            />
          </li>
        ))}
      </ul>
      <div className="prompt__actions">
        {prompt.can_finish && (
          <button type="button" onClick={() => send(null)}>
            Finish
          </button>
        )}
        {prompt.can_cancel && !prompt.can_finish && (
          <button type="button" onClick={() => send(null)}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function CounterPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectCounter>) {
  const [counts, setCounts] = useState(() => prompt.cards.map(() => 0));
  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <div>
      <p>
        Remove {prompt.count} counter{prompt.count > 1 ? "s" : ""} (chosen:{" "}
        {total})
      </p>
      {prompt.cards.map((c, i) => (
        <label key={i} className="prompt__counter">
          {ctx.name(c.code)}
          <input
            type="number"
            min={0}
            max={c.count}
            value={counts[i]}
            aria-label={`Counters from ${ctx.name(c.code)}`}
            onChange={(e) =>
              setCounts(
                counts.map((n, j) =>
                  j === i
                    ? Math.max(0, Math.min(c.count, Number(e.target.value)))
                    : n,
                ),
              )
            }
          />
        </label>
      ))}
      <ConfirmRow
        ok={total === prompt.count}
        onConfirm={() =>
          respond({ type: ResponseType.SELECT_COUNTER, counters: counts })
        }
      />
    </div>
  );
}

/**
 * Pick cards whose values add up to `amount` (exactly, or at least when select_max is set).
 * Indices cover selects_must first, then selects; required cards are always sent.
 */
export function SumPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectSum>) {
  const must = prompt.selects_must.length;
  const all = [...prompt.selects_must, ...prompt.selects];
  const locked = Array.from({ length: must }, (_, i) => i);
  const [picked, setPicked] = useState<number[]>(locked);
  const total = picked.reduce((sum, i) => sum + all[i].amount, 0);
  const chosen = picked.length - must;
  const reached = prompt.select_max
    ? total >= prompt.amount
    : total === prompt.amount;
  const ok = reached && chosen >= prompt.min && chosen <= prompt.max;
  return (
    <div>
      <p>
        Reach {prompt.amount} (now: {total})
      </p>
      <PickList
        cards={all}
        picked={picked}
        locked={locked}
        label={(i) => `${ctx.name(all[i].code)} (${all[i].amount})`}
        onToggle={(i) => setPicked(toggle(picked, i))}
        me={ctx.me}
        name={ctx.name}
        images={ctx.images}
        onHover={ctx.hover}
      />
      <ConfirmRow
        ok={ok}
        onConfirm={() =>
          respond({ type: ResponseType.SELECT_SUM, indicies: picked })
        }
      />
    </div>
  );
}

/** Answers with order[i] = new position of card i, or null to keep the order. */
export function SortPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSortCard | OcgMessageSortChain>) {
  const [list, setList] = useState(() => prompt.cards.map((_, i) => i));
  const moveUp = (pos: number) => {
    if (pos === 0) return;
    const next = [...list];
    [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
    setList(next);
  };
  const order = prompt.cards.map((_, i) => list.indexOf(i));
  return (
    <div>
      <ol className="prompt__cards">
        {list.map((cardIndex, pos) => {
          const name = ctx.name(prompt.cards[cardIndex].code);
          return (
            <li key={cardIndex}>
              {name}{" "}
              <button
                type="button"
                disabled={pos === 0}
                onClick={() => moveUp(pos)}
                aria-label={`Move ${name} up`}
              >
                ↑
              </button>
            </li>
          );
        })}
      </ol>
      <div className="prompt__actions">
        <button
          type="button"
          onClick={() => respond({ type: ResponseType.SORT_CARD, order })}
        >
          Confirm order
        </button>
        <button
          type="button"
          onClick={() => respond({ type: ResponseType.SORT_CARD, order: null })}
        >
          Keep order
        </button>
      </div>
    </div>
  );
}
