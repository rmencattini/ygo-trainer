import {
  MessageType,
  openPlaces,
  ResponseType,
  type OcgMessageSelectDisfield,
  type OcgMessageSelectPlace,
  type SelectFieldPlace,
} from "@ygo/engine";
import { useState } from "react";
import type { PromptProps } from "./context";
import { zoneName } from "./labels";

/** Pick `count` zones; the answer goes out as soon as enough are picked. */
export function ZonePrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectPlace | OcgMessageSelectDisfield>) {
  const [picked, setPicked] = useState<SelectFieldPlace[]>([]);
  const type =
    prompt.type === MessageType.SELECT_PLACE
      ? ResponseType.SELECT_PLACE
      : ResponseType.SELECT_DISFIELD;
  const pick = (place: SelectFieldPlace) => {
    const next = [...picked, place];
    if (next.length >= prompt.count) respond({ type, places: next } as never);
    else setPicked(next);
  };
  const key = (p: SelectFieldPlace) =>
    `${p.player}-${p.location}-${p.sequence}`;
  const taken = new Set(picked.map(key));
  const open = openPlaces(prompt).filter((p) => !taken.has(key(p)));
  return (
    <div className="prompt__actions">
      {open.map((p) => (
        <button key={key(p)} type="button" onClick={() => pick(p)}>
          {zoneName(p.player, p.location, p.sequence, ctx.me)}
        </button>
      ))}
    </div>
  );
}
