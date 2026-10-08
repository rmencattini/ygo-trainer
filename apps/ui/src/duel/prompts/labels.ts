import { CardLocation, OcgAttribute, OcgRace } from "@ygo/engine";

const LOCATIONS: Record<number, string> = {
  [CardLocation.DECK]: "Deck",
  [CardLocation.HAND]: "hand",
  [CardLocation.MZONE]: "Monster Zone",
  [CardLocation.SZONE]: "Spell & Trap Zone",
  [CardLocation.GRAVE]: "GY",
  [CardLocation.REMOVED]: "banishment",
  [CardLocation.EXTRA]: "Extra Deck",
  [CardLocation.OVERLAY]: "Xyz Material",
};

export function zoneName(
  player: number,
  location: number,
  sequence: number,
  me: number,
): string {
  const owner = player === me ? "Your" : "Opponent's";
  if (location === CardLocation.MZONE) {
    if (sequence < 5) return `${owner} Monster Zone ${sequence + 1}`;
    return `${owner} Extra Monster Zone ${sequence === 5 ? "left" : "right"}`;
  }
  if (sequence < 5) return `${owner} Spell & Trap Zone ${sequence + 1}`;
  if (sequence === 5) return `${owner} Field Zone`;
  return `${owner} Pendulum Zone ${sequence === 6 ? "left" : "right"}`;
}

export function whereLabel(
  controller: number,
  location: number,
  me: number,
): string {
  const owner = controller === me ? "your" : "opponent's";
  return `${owner} ${LOCATIONS[location] ?? "field"}`;
}

const SPECIAL_NAMES: Record<string, string> = {
  WINGEDBEAST: "Winged Beast",
  BEASTWARRIOR: "Beast-Warrior",
  SEASERPENT: "Sea Serpent",
  DIVINE: "Divine-Beast",
  CREATORGOD: "Creator God",
};

const titleCase = (key: string) =>
  SPECIAL_NAMES[key] ?? key.charAt(0) + key.slice(1).toLowerCase();

export const RACES: { value: bigint; label: string }[] = Object.entries(OcgRace)
  .filter(([, v]) => typeof v === "bigint")
  .map(([k, v]) => ({ value: v as bigint, label: titleCase(k) }));

export const ATTRIBUTES: { value: number; label: string }[] = Object.entries(
  OcgAttribute,
)
  .filter(([, v]) => typeof v === "number")
  .map(([k, v]) => ({ value: v as number, label: titleCase(k) }));
