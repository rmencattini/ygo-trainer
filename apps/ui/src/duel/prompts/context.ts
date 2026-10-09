import type { Message, OcgOpCode, Response } from "@ygo/engine";
import type { ImageSource } from "../../cards/CardImage";

export interface CardRef {
  controller: 0 | 1;
  location: number;
  sequence: number;
}

export interface PromptContext {
  /** The human player. */
  me: 0 | 1;
  name(code: number): string;
  describe(description: bigint): string;
  /** Text of the last "select …" hint the engine sent, if any. */
  hint: string | null;
  /** Card art for card picks; without it they show names only. */
  images?: ImageSource;
  /** The latest log line, so a chain question can say what it answers. */
  lastEvent?: string | null;
  /** Card clicked on the board: prompts show only its choices. */
  focus: CardRef | null;
  /** Cards you may declare for ANNOUNCE_CARD that match `query`. */
  announceCandidates(
    opcodes: OcgOpCode[],
    query: string,
  ): { code: number; name: string }[];
}

export interface PromptProps<T extends Message> {
  prompt: T;
  ctx: PromptContext;
  respond(response: Response): void;
}

export const sameCard = (a: CardRef, b: CardRef | null) =>
  !!b &&
  a.controller === b.controller &&
  a.location === b.location &&
  a.sequence === b.sequence;
