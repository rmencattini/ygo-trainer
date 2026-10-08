// Prompts answered with one click: menus, yes/no, options, chains, positions, numbers, RPS.
import {
  MessageType,
  OcgRPS,
  ResponseType,
  SelectBattleCMDAction,
  SelectIdleCMDAction,
  type OcgMessageAnnounceNumber,
  type OcgMessageRockPaperScissors,
  type OcgMessageSelectBattleCMD,
  type OcgMessageSelectChain,
  type OcgMessageSelectEffectYN,
  type OcgMessageSelectIdlecmd,
  type OcgMessageSelectOption,
  type OcgMessageSelectPosition,
  type OcgMessageSelectYesno,
} from "@ygo/engine";
import { sameCard, type CardRef, type PromptProps } from "./context";

interface Action {
  label: string;
  card?: CardRef;
  run(): void;
}

function ActionList({
  actions,
  focus,
}: {
  actions: Action[];
  focus: CardRef | null;
}) {
  const shown = actions.filter(
    (a) => !focus || !a.card || sameCard(a.card, focus),
  );
  return (
    <div className="prompt__actions">
      {shown.map((a, i) => (
        <button key={i} type="button" onClick={a.run}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

export function IdleCmdPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectIdlecmd>) {
  const send = (action: SelectIdleCMDAction, index: number | null) =>
    respond({ type: ResponseType.SELECT_IDLECMD, action, index });
  const lists: [
    SelectIdleCMDAction,
    string,
    OcgMessageSelectIdlecmd["summons"],
  ][] = [
    [SelectIdleCMDAction.SELECT_SUMMON, "Normal Summon", prompt.summons],
    [
      SelectIdleCMDAction.SELECT_SPECIAL_SUMMON,
      "Special Summon",
      prompt.special_summons,
    ],
    [SelectIdleCMDAction.SELECT_MONSTER_SET, "Set", prompt.monster_sets],
    [SelectIdleCMDAction.SELECT_SPELL_SET, "Set", prompt.spell_sets],
    [
      SelectIdleCMDAction.SELECT_POS_CHANGE,
      "Change position of",
      prompt.pos_changes,
    ],
  ];
  const actions: Action[] = [];
  for (const [action, verb, cards] of lists) {
    cards.forEach((c, i) =>
      actions.push({
        label: `${verb} ${ctx.name(c.code)}`,
        card: c,
        run: () => send(action, i),
      }),
    );
  }
  prompt.activates.forEach((c, i) =>
    actions.push({
      label: `Activate ${ctx.name(c.code)}: ${ctx.describe(c.description)}`,
      card: c,
      run: () => send(SelectIdleCMDAction.SELECT_ACTIVATE, i),
    }),
  );
  if (prompt.to_bp)
    actions.push({
      label: "Battle Phase",
      run: () => send(SelectIdleCMDAction.TO_BP, null),
    });
  if (prompt.to_ep)
    actions.push({
      label: "End Turn",
      run: () => send(SelectIdleCMDAction.TO_EP, null),
    });
  return <ActionList actions={actions} focus={ctx.focus} />;
}

export function BattleCmdPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectBattleCMD>) {
  const send = (action: SelectBattleCMDAction, index: number | null) =>
    respond({ type: ResponseType.SELECT_BATTLECMD, action, index });
  const actions: Action[] = [
    ...prompt.attacks.map((c, i) => ({
      label: `Attack with ${ctx.name(c.code)}`,
      card: c,
      run: () => send(SelectBattleCMDAction.SELECT_BATTLE, i),
    })),
    ...prompt.chains.map((c, i) => ({
      label: `Activate ${ctx.name(c.code)}: ${ctx.describe(c.description)}`,
      card: c,
      run: () => send(SelectBattleCMDAction.SELECT_CHAIN, i),
    })),
  ];
  if (prompt.to_m2)
    actions.push({
      label: "Main Phase 2",
      run: () => send(SelectBattleCMDAction.TO_M2, null),
    });
  if (prompt.to_ep)
    actions.push({
      label: "End Turn",
      run: () => send(SelectBattleCMDAction.TO_EP, null),
    });
  return <ActionList actions={actions} focus={ctx.focus} />;
}

function YesNo({
  question,
  onAnswer,
}: {
  question: string;
  onAnswer(yes: boolean): void;
}) {
  return (
    <div>
      <p>{question}</p>
      <div className="prompt__actions">
        <button type="button" onClick={() => onAnswer(true)}>
          Yes
        </button>
        <button type="button" onClick={() => onAnswer(false)}>
          No
        </button>
      </div>
    </div>
  );
}

export function EffectYnPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectEffectYN>) {
  return (
    <YesNo
      question={`Use the effect of ${ctx.name(prompt.code)}? ${ctx.describe(prompt.description)}`}
      onAnswer={(yes) => respond({ type: ResponseType.SELECT_EFFECTYN, yes })}
    />
  );
}

export function YesNoPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectYesno>) {
  return (
    <YesNo
      question={ctx.describe(prompt.description)}
      onAnswer={(yes) => respond({ type: ResponseType.SELECT_YESNO, yes })}
    />
  );
}

export function OptionPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectOption>) {
  const actions = prompt.options.map((o, index) => ({
    label: ctx.describe(o),
    run: () => respond({ type: ResponseType.SELECT_OPTION, index }),
  }));
  return <ActionList actions={actions} focus={null} />;
}

export function ChainPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectChain>) {
  const actions: Action[] = prompt.selects.map((c, index) => ({
    label: `Activate ${ctx.name(c.code)}: ${ctx.describe(c.description)}`,
    card: c,
    run: () => respond({ type: ResponseType.SELECT_CHAIN, index }),
  }));
  if (!prompt.forced) {
    actions.push({
      label: "Don't chain",
      run: () => respond({ type: ResponseType.SELECT_CHAIN, index: null }),
    });
  }
  return <ActionList actions={actions} focus={ctx.focus} />;
}

const POSITIONS: [number, string][] = [
  [0x1, "Face-up Attack"],
  [0x2, "Face-down Attack"],
  [0x4, "Face-up Defense"],
  [0x8, "Face-down Defense"],
];

export function PositionPrompt({
  prompt,
  ctx,
  respond,
}: PromptProps<OcgMessageSelectPosition>) {
  const actions = POSITIONS.filter(([bit]) => prompt.positions & bit).map(
    ([bit, label]) => ({
      label,
      run: () =>
        respond({ type: ResponseType.SELECT_POSITION, position: bit as never }),
    }),
  );
  return (
    <div>
      <p>{ctx.name(prompt.code)}</p>
      <ActionList actions={actions} focus={null} />
    </div>
  );
}

/** ANNOUNCE_NUMBER answers with the index of the chosen option. */
export function NumberPrompt({
  prompt,
  respond,
}: PromptProps<OcgMessageAnnounceNumber>) {
  const actions = prompt.options.map((n, value) => ({
    label: String(n),
    run: () => respond({ type: ResponseType.ANNOUNCE_NUMBER, value }),
  }));
  return <ActionList actions={actions} focus={null} />;
}

export function RpsPrompt({
  respond,
}: PromptProps<OcgMessageRockPaperScissors>) {
  const actions = (
    [
      ["Rock", OcgRPS.ROCK],
      ["Paper", OcgRPS.PAPER],
      ["Scissors", OcgRPS.SCISSORS],
    ] as const
  ).map(([label, value]) => ({
    label,
    run: () =>
      respond({
        type: ResponseType.ROCK_PAPER_SCISSORS,
        value: value as 1 | 2 | 3,
      }),
  }));
  return <ActionList actions={actions} focus={null} />;
}

export const ONE_CLICK = new Set<MessageType>([
  MessageType.SELECT_IDLECMD,
  MessageType.SELECT_BATTLECMD,
  MessageType.SELECT_EFFECTYN,
  MessageType.SELECT_YESNO,
  MessageType.SELECT_OPTION,
  MessageType.SELECT_CHAIN,
  MessageType.SELECT_POSITION,
  MessageType.ANNOUNCE_NUMBER,
  MessageType.ROCK_PAPER_SCISSORS,
]);
