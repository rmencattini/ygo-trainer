import {
  OcgLocation,
  type OcgMessageSelectDisfield,
  type OcgMessageSelectPlace,
  type SelectFieldPlace,
} from "ocgcore-wasm";

/**
 * Zones a SELECT_PLACE / SELECT_DISFIELD prompt offers, in order.
 * `field_mask` marks blocked zones: bits 0-7 MZONE, 8-15 SZONE, +16 for the opponent.
 */
export function openPlaces(
  prompt: OcgMessageSelectPlace | OcgMessageSelectDisfield,
): SelectFieldPlace[] {
  const places: SelectFieldPlace[] = [];
  for (let bit = 0; bit < 32; bit++) {
    if (prompt.field_mask & (1 << bit)) continue;
    const local = bit % 16;
    if (local === 7) continue; // no 8th Monster Zone
    places.push({
      player: bit >= 16 ? 1 - prompt.player : prompt.player,
      location: local < 8 ? OcgLocation.MZONE : OcgLocation.SZONE,
      sequence: local % 8,
    });
  }
  return places;
}
