import { MessageType, type Message } from "@ygo/engine";
import type { ReactNode } from "react";
import { AttributePrompt, CardNamePrompt, RacePrompt } from "./Declare";
import {
  CounterPrompt,
  SelectCardPrompt,
  SortPrompt,
  SumPrompt,
  TributePrompt,
  UnselectCardPrompt,
} from "./Cards";
import {
  BattleCmdPrompt,
  ChainPrompt,
  EffectYnPrompt,
  IdleCmdPrompt,
  NumberPrompt,
  OptionPrompt,
  PositionPrompt,
  RpsPrompt,
  YesNoPrompt,
} from "./Choices";
import type { PromptContext, PromptProps } from "./context";
import { ZonePrompt } from "./Zones";

const TITLES: Partial<Record<MessageType, string>> = {
  [MessageType.SELECT_IDLECMD]: "Your move",
  [MessageType.SELECT_BATTLECMD]: "Battle Phase",
  [MessageType.SELECT_EFFECTYN]: "Use an effect?",
  [MessageType.SELECT_YESNO]: "Choose",
  [MessageType.SELECT_OPTION]: "Select an option",
  [MessageType.SELECT_CARD]: "Select cards",
  [MessageType.SELECT_TRIBUTE]: "Select Tributes",
  [MessageType.SELECT_UNSELECT_CARD]: "Select cards",
  [MessageType.SELECT_CHAIN]: "Chain?",
  [MessageType.SELECT_PLACE]: "Select a zone",
  [MessageType.SELECT_DISFIELD]: "Select zones",
  [MessageType.SELECT_POSITION]: "Select the battle position",
  [MessageType.SELECT_COUNTER]: "Remove counters",
  [MessageType.SELECT_SUM]: "Select cards",
  [MessageType.SORT_CARD]: "Order the cards",
  [MessageType.SORT_CHAIN]: "Order the chain",
  [MessageType.ANNOUNCE_RACE]: "Declare a Type",
  [MessageType.ANNOUNCE_ATTRIB]: "Declare an Attribute",
  [MessageType.ANNOUNCE_CARD]: "Declare a card name",
  [MessageType.ANNOUNCE_NUMBER]: "Declare a number",
  [MessageType.ROCK_PAPER_SCISSORS]: "Rock, paper, scissors",
};

function body(props: PromptProps<Message>): ReactNode {
  const { prompt } = props;
  const p = props as unknown as PromptProps<never>;
  switch (prompt.type) {
    case MessageType.SELECT_IDLECMD:
      return <IdleCmdPrompt {...p} />;
    case MessageType.SELECT_BATTLECMD:
      return <BattleCmdPrompt {...p} />;
    case MessageType.SELECT_EFFECTYN:
      return <EffectYnPrompt {...p} />;
    case MessageType.SELECT_YESNO:
      return <YesNoPrompt {...p} />;
    case MessageType.SELECT_OPTION:
      return <OptionPrompt {...p} />;
    case MessageType.SELECT_CARD:
      return <SelectCardPrompt {...p} />;
    case MessageType.SELECT_TRIBUTE:
      return <TributePrompt {...p} />;
    case MessageType.SELECT_UNSELECT_CARD:
      return <UnselectCardPrompt {...p} />;
    case MessageType.SELECT_CHAIN:
      return <ChainPrompt {...p} />;
    case MessageType.SELECT_PLACE:
    case MessageType.SELECT_DISFIELD:
      return <ZonePrompt {...p} />;
    case MessageType.SELECT_POSITION:
      return <PositionPrompt {...p} />;
    case MessageType.SELECT_COUNTER:
      return <CounterPrompt {...p} />;
    case MessageType.SELECT_SUM:
      return <SumPrompt {...p} />;
    case MessageType.SORT_CARD:
    case MessageType.SORT_CHAIN:
      return <SortPrompt {...p} />;
    case MessageType.ANNOUNCE_RACE:
      return <RacePrompt {...p} />;
    case MessageType.ANNOUNCE_ATTRIB:
      return <AttributePrompt {...p} />;
    case MessageType.ANNOUNCE_CARD:
      return <CardNamePrompt {...p} />;
    case MessageType.ANNOUNCE_NUMBER:
      return <NumberPrompt {...p} />;
    case MessageType.ROCK_PAPER_SCISSORS:
      return <RpsPrompt {...p} />;
    default:
      return <p>Unsupported prompt ({prompt.type}).</p>;
  }
}

/** Prompts where you pick among cards open as a dialog over the table. */
const PICKS = new Set<number>([
  MessageType.SELECT_CARD,
  MessageType.SELECT_TRIBUTE,
  MessageType.SELECT_UNSELECT_CARD,
  MessageType.SELECT_SUM,
  MessageType.SELECT_COUNTER,
  MessageType.SORT_CARD,
  MessageType.SORT_CHAIN,
]);

export function PromptPanel(props: {
  prompt: Message;
  ctx: PromptContext;
  respond: PromptProps<Message>["respond"];
  /** Show only the title and a way back to the actions (choice prompts only). */
  folded?: boolean;
  onUnfold?: () => void;
}) {
  const title =
    props.ctx.hint ?? TITLES[props.prompt.type as MessageType] ?? "Choose";
  const content = (
    <>
      <h3>{title}</h3>
      {props.prompt.type === MessageType.SELECT_CHAIN &&
        props.ctx.lastEvent && (
          <p className="prompt__event">{props.ctx.lastEvent}</p>
        )}
      {/* key: a new prompt starts with fresh picks */}
      <div
        key={JSON.stringify(props.prompt, (_, v) =>
          typeof v === "bigint" ? String(v) : v,
        )}
      >
        {body(props)}
      </div>
    </>
  );
  if (PICKS.has(props.prompt.type)) {
    return (
      <div className="prompt prompt--dialog" role="dialog" aria-label={title}>
        {content}
      </div>
    );
  }
  if (props.folded) {
    return (
      <section
        className="prompt prompt--dock prompt--folded"
        aria-label="Prompt"
      >
        <h3>{title}</h3>
        <button type="button" onClick={props.onUnfold}>
          Show actions
        </button>
      </section>
    );
  }
  return (
    <section className="prompt prompt--dock" aria-label="Prompt">
      {content}
    </section>
  );
}
