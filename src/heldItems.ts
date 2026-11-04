import type { Pokemon } from "./types.js";
import { MACHO_BRACE_MAX, MAX_IV, SOUL_DEW_MAX } from "./fuse.js";

/**
 * Most stacks of each held item, as PokeRogue allows them. The vitamin limit here is the highest
 * a Pokémon can ever have (31); in the game the real limit for each vitamin is that stat's IV.
 */
export const HELD_ITEM_LIMITS = {
  soulDew: SOUL_DEW_MAX,
  machoBrace: MACHO_BRACE_MAX,
  vitamin: MAX_IV,
} as const;

/** Keeps a typed stack count a whole number from 0 up to `max`. Anything unreadable becomes 0. */
export function clampCount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.floor(value)));
}

/** A held item that only helps certain species, each limited to one stack (as in PokeRogue). */
export interface SpeciesItem {
  id: string;
  name: string;
  /** Short description of the boost. */
  effect: string;
  /** Dex labels (the `name` field in data/pokemon.json) this item works for, including their forms. */
  species: readonly string[];
  /** Stats the item doubles, as STAT_NAMES indexes (0 HP, 1 Atk, 2 Def, 3 SpA, 4 SpD, 5 Spe). */
  stats: readonly number[];
}

/** The six species-specific items in PokeRogue, in the order they are shown. */
export const SPECIES_ITEMS: readonly SpeciesItem[] = [
  { id: "deep-sea-tooth", name: "Deep Sea Tooth", effect: "doubles Sp. Atk", species: ["Clamperl"], stats: [3] },
  { id: "deep-sea-scale", name: "Deep Sea Scale", effect: "doubles Sp. Def", species: ["Clamperl"], stats: [4] },
  { id: "light-ball", name: "Light Ball", effect: "doubles Atk and Sp. Atk", species: ["Pikachu"], stats: [1, 3] },
  { id: "thick-club", name: "Thick Club", effect: "doubles Atk", species: ["Cubone", "Marowak", "Alolan Marowak"], stats: [1] },
  { id: "metal-powder", name: "Metal Powder", effect: "doubles Def", species: ["Ditto"], stats: [2] },
  { id: "quick-powder", name: "Quick Powder", effect: "doubles Speed", species: ["Ditto"], stats: [5] },
];

/**
 * Whether a dex entry is one of the listed species. Forms count ("Pikachu (Cosplay)" is a Pikachu), but a
 * different species that merely contains the name does not, and "Marowak" does not cover "Alolan Marowak".
 */
export function matchesSpecies(entryName: string, species: readonly string[]): boolean {
  return species.some(label => entryName === label || entryName.startsWith(`${label} (`));
}

/**
 * The species items worth offering for this pair. PokeRogue applies one when the holder's own species OR its
 * fusion partner is on the item's list, so either picked Pokémon can unlock it.
 */
export function speciesItemsFor(primary: Pokemon, secondary: Pokemon): SpeciesItem[] {
  return SPECIES_ITEMS.filter(
    item => matchesSpecies(primary.name, item.species) || matchesSpecies(secondary.name, item.species),
  );
}

/** Species items double the stat (PokeRogue's SpeciesStatBoosterModifier, multiplier 2). */
export const SPECIES_ITEM_MULTIPLIER = 2;
export const EVIOLITE_MULTIPLIER = 1.5;
/** Eviolite's stats as STAT_NAMES indexes: Def and Sp. Def. */
export const EVIOLITE_STATS: readonly number[] = [2, 4];

/**
 * How much Eviolite multiplies Def and Sp. Def for a fused Pokémon (PokeRogue's EvolutionStatBoosterModifier):
 * nothing if either Pokémon is a Gigantamax or Eternamax form; the full 1.5 if both can still evolve;
 * half of it (1.25) if only one can; nothing if neither can.
 */
export function evioliteMultiplier(primary: Pokemon, secondary: Pokemon): number {
  if (primary.isMax || secondary.isMax) return 1;
  if (primary.canEvolve && secondary.canEvolve) return EVIOLITE_MULTIPLIER;
  if (primary.canEvolve || secondary.canEvolve) return 1 + (EVIOLITE_MULTIPLIER - 1) / 2;
  return 1;
}

/** Which of the optional items the user has ticked. `species` holds SpeciesItem ids. */
export interface BattleItems {
  eviolite: boolean;
  species: readonly string[];
}

/**
 * The in-battle multiplier for one stat from Eviolite and species items. The game applies these after the
 * permanent stat is worked out (Pokemon.getEffectiveStat), so they are kept apart from it. Ticked items
 * that do not apply to the picked pair are ignored.
 */
export function battleMultiplier(statIndex: number, primary: Pokemon, secondary: Pokemon, items: BattleItems): number {
  let multiplier = 1;
  if (items.eviolite && EVIOLITE_STATS.includes(statIndex)) multiplier *= evioliteMultiplier(primary, secondary);
  for (const item of speciesItemsFor(primary, secondary)) {
    if (items.species.includes(item.id) && item.stats.includes(statIndex)) multiplier *= SPECIES_ITEM_MULTIPLIER;
  }
  return multiplier;
}

/** The permanent stat with the in-battle multiplier applied, rounded down and never below 1. */
export function battleStat(permanent: number, multiplier: number): number {
  return Math.max(Math.floor(permanent * multiplier), 1);
}
