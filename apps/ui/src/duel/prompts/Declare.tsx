import {
  ResponseType,
  type OcgMessageAnnounceAttrib,
  type OcgMessageAnnounceCard,
  type OcgMessageAnnounceRace,
} from "@ygo/engine";
import { useState } from "react";
import type { PromptProps } from "./context";
import { ATTRIBUTES, RACES } from "./labels";

/** Click until `count` values are chosen; the answer goes out on the last click. */
function PickValues<T extends number | bigint>(props: {
  options: { value: T; label: string }[];
  count: number;
  onDone(values: T[]): void;
}) {
  const [picked, setPicked] = useState<T[]>([]);
  const pick = (value: T) => {
    const next = [...picked, value];
    if (next.length >= props.count) props.onDone(next);
    else setPicked(next);
  };
  return (
    <div className="prompt__actions">
      {props.options
        .filter((o) => !picked.includes(o.value))
        .map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => pick(o.value)}
          >
            {o.label}
          </button>
        ))}
    </div>
  );
}

export function RacePrompt({
  prompt,
  respond,
}: PromptProps<OcgMessageAnnounceRace>) {
  const available = BigInt(prompt.available);
  return (
    <PickValues
      options={RACES.filter((r) => available & r.value)}
      count={prompt.count}
      onDone={(races) =>
        respond({ type: ResponseType.ANNOUNCE_RACE, races: races as never })
      }
    />
  );
}

export function AttributePrompt({
  prompt,
  respond,
}: PromptProps<OcgMessageAnnounceAttrib>) {
  return (
    <PickValues
      options={ATTRIBUTES.filter((a) => prompt.available & a.value)}
      count={prompt.count}
      onDone={(attributes) =>
        respond({
          type: ResponseType.ANNOUNCE_ATTRIB,
          attributes: attributes as never,
        })
      }
    />
  );
}

export function CardNamePrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageAnnounceCard>) {
  const [query, setQuery] = useState("");
  const found =
    query.trim().length >= 2
      ? ctx.announceCandidates(prompt.opcodes, query).slice(0, 20)
      : [];
  return (
    <div>
      <input
        aria-label="Card name"
        value={query}
        placeholder="Type a card name…"
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="prompt__actions">
        {found.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() =>
              respond({ type: ResponseType.ANNOUNCE_CARD, card: c.code })
            }
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
