import { describe, expect, it } from "vitest";
import {
  CardLocation,
  CardPosition,
  MessageType,
  Phase,
  type Message,
  type OcgLocPos,
} from ".";
import { describeEffect, logLine, type TextSource } from "./english";

const NAMES: Record<number, string> = {
  100: "Ash Blossom & Joyous Spring",
  200: "Gene-Warped Warwolf",
};
const texts: TextSource = {
  name: (code) => NAMES[code] ?? `#${code}`,
  cardString: (code, index) =>
    code === 100 && index === 0 ? "Negate the effect" : undefined,
  system: (id) => ({ 1: "Normal Summon", 555: "Select an option" })[id],
};
const line = (message: Partial<Message>, field: Record<number, number> = {}) =>
  logLine(message as Message, texts, 0, (loc) => field[loc.sequence] ?? 0);
const at = (controller: 0 | 1, location: number) =>
  ({
    controller,
    location,
    sequence: 0,
    position: 1,
  }) as OcgLocPos;

describe("describeEffect", () => {
  it("reads card strings packed as code << 20 | index", () => {
    expect(describeEffect((100n << 20n) | 0n, texts)).toBe("Negate the effect");
  });
  it("reads system strings for small values", () => {
    expect(describeEffect(1n, texts)).toBe("Normal Summon");
  });
  it("falls back to the card name, then to a generic label", () => {
    expect(describeEffect((100n << 20n) | 3n, texts)).toBe(
      "Ash Blossom & Joyous Spring effect",
    );
    expect(describeEffect(99999n, texts)).toBe("Effect");
  });
});

describe("logLine", () => {
  it("names turns and phases", () => {
    expect(line({ type: MessageType.NEW_TURN, player: 0 })).toBe("Your turn");
    expect(line({ type: MessageType.NEW_TURN, player: 1 })).toBe(
      "Opponent's turn",
    );
    expect(line({ type: MessageType.NEW_PHASE, phase: Phase.MAIN1 })).toBe(
      "Main Phase 1",
    );
  });

  it("names your draws but hides the opponent's", () => {
    expect(
      line({
        type: MessageType.DRAW,
        player: 0,
        drawn: [{ code: 200, position: 1 }],
      }),
    ).toBe("You draw Gene-Warped Warwolf");
    expect(
      line({
        type: MessageType.DRAW,
        player: 1,
        drawn: [
          { code: 0, position: 10 },
          { code: 0, position: 10 },
        ],
      }),
    ).toBe("Opponent draws 2 cards");
  });

  it("describes summons and Sets", () => {
    expect(
      line({ type: MessageType.SUMMONING, code: 200, controller: 0 }),
    ).toBe("You Normal Summon Gene-Warped Warwolf");
    expect(
      line({ type: MessageType.SPSUMMONING, code: 200, controller: 1 }),
    ).toBe("Opponent Special Summons Gene-Warped Warwolf");
    expect(
      line({
        type: MessageType.SET,
        code: 0,
        controller: 1,
        location: CardLocation.SZONE,
      }),
    ).toBe("Opponent Sets a card");
  });

  it("describes chains", () => {
    expect(
      line({
        type: MessageType.CHAINING,
        code: 100,
        controller: 1,
        description: 100n << 20n,
        chain_size: 1,
      }),
    ).toBe(
      "Chain Link 1: Opponent activates Ash Blossom & Joyous Spring (Negate the effect)",
    );
    expect(line({ type: MessageType.CHAIN_SOLVING, chain_size: 1 })).toBe(
      "Chain Link 1 resolves",
    );
    expect(line({ type: MessageType.CHAIN_NEGATED, chain_size: 2 })).toBe(
      "Chain Link 2 is negated",
    );
  });

  it("describes cards leaving for the GY, banishment and the hand", () => {
    const from = at(0, CardLocation.MZONE);
    expect(
      line({
        type: MessageType.MOVE,
        card: 200,
        from,
        to: at(0, CardLocation.GRAVE),
      }),
    ).toBe("Gene-Warped Warwolf is sent to your GY");
    expect(
      line({
        type: MessageType.MOVE,
        card: 200,
        from,
        to: at(1, CardLocation.REMOVED),
      }),
    ).toBe("Gene-Warped Warwolf is banished");
    expect(
      line({
        type: MessageType.MOVE,
        card: 200,
        from: at(0, CardLocation.DECK),
        to: at(0, CardLocation.HAND),
      }),
    ).toBe("You add Gene-Warped Warwolf to your hand");
    expect(
      line({
        type: MessageType.MOVE,
        card: 200,
        from: at(0, CardLocation.HAND),
        to: at(0, CardLocation.MZONE),
      }),
    ).toBeNull();
  });

  it("describes LP changes, attacks and the result", () => {
    expect(line({ type: MessageType.DAMAGE, player: 0, amount: 1000 })).toBe(
      "You take 1000 damage",
    );
    expect(line({ type: MessageType.RECOVER, player: 1, amount: 500 })).toBe(
      "Opponent gains 500 LP",
    );
    expect(line({ type: MessageType.PAY_LPCOST, player: 0, amount: 800 })).toBe(
      "You pay 800 LP",
    );
    const attacker = {
      ...at(0, CardLocation.MZONE),
      position: CardPosition.FACEUP_ATTACK,
    };
    expect(
      line(
        { type: MessageType.ATTACK, card: attacker, target: null },
        { 0: 200 },
      ),
    ).toBe("Gene-Warped Warwolf attacks directly");
    expect(line({ type: MessageType.WIN, player: 0, reason: 1 })).toBe(
      "You win",
    );
  });

  it("skips messages with nothing to say", () => {
    expect(line({ type: MessageType.UPDATE_DATA })).toBeNull();
  });
});
