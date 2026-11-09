import { abilityMultiplier } from "./abilityStats.js";
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

/** Everything one Pokémon holds that the calculator knows about. */
export interface HeldItems {
  soulDew: number;
  machoBrace: number;
  /** One stack count per stat, in STAT_NAMES order (HP Up, Protein, Iron, Calcium, Zinc, Carbos). */
  vitamins: number[];
  /**
   * Sweet and Foul Shuckle Juice and Old Gateau only matter by being held at all: the game applies each once
   * however many stacks there are (Shuckle Juice allows two, Old Gateau one).
   */
  sweetJuice: boolean;
  foulJuice: boolean;
  oldGateau: boolean;
  eviolite: boolean;
  /** Ids of the ticked species items. */
  species: string[];
}

export const VITAMIN_NAMES = ["HP Up", "Protein", "Iron", "Calcium", "Zinc", "Carbos"] as const;

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
  /** Abilities in effect (see activeAbilities); only the ones that change a stat on their own matter. */
  abilities?: readonly string[];
}

/**
 * The in-battle multiplier for one stat from Eviolite, species items and abilities like Huge Power. The game applies these after the
 * permanent stat is worked out (Pokemon.getEffectiveStat), so they are kept apart from it. Ticked items
 * that do not apply to the picked pair are ignored.
 */
export function battleMultiplier(statIndex: number, primary: Pokemon, secondary: Pokemon, items: BattleItems): number {
  let multiplier = 1;
  if (items.eviolite && EVIOLITE_STATS.includes(statIndex)) multiplier *= evioliteMultiplier(primary, secondary);
  for (const item of speciesItemsFor(primary, secondary)) {
    if (items.species.includes(item.id) && item.stats.includes(statIndex)) multiplier *= SPECIES_ITEM_MULTIPLIER;
  }
  multiplier *= abilityMultiplier(statIndex, items.abilities ?? []);
  return multiplier;
}

/** The permanent stat with the in-battle multiplier applied, rounded down and never below 1. */
export function battleStat(permanent: number, multiplier: number): number {
  return Math.max(Math.floor(permanent * multiplier), 1);
}

/** The species items one Pokémon can use itself (its species or one of its forms is on the item's list). */
export function speciesItemsOf(pokemon: Pokemon): SpeciesItem[] {
  return SPECIES_ITEMS.filter(item => matchesSpecies(pokemon.name, item.species));
}

/**
 * The stack a Pokémon ends up with when another Pokémon's stack of the same item is fused into it, following
 * PokeRogue's PlayerPokemon.fuse and BattleScene.tryTransferHeldItemModifier:
 * - If it holds none of the item, the whole stack moves over. That stack is not checked against this Pokémon's
 *   own limit, which only matters for vitamins (their limit is the holder's IV).
 * - If it already holds the item, the stacks add up to the limit, and a full stack takes nothing.
 */
export function mergeStacks(own: number, other: number, max: number): number {
  if (own === 0) return other;
  if (own >= max) return own;
  return Math.min(own + other, max);
}

/**
 * What the fused Pokémon holds: the primary Pokémon's items plus everything the secondary held, which the game
 * moves onto the primary when they fuse. `ivs` are the primary Pokémon's, since they set its vitamin limits.
 */
export function mergeHeldItems(primary: HeldItems, secondary: HeldItems, ivs: readonly number[]): HeldItems {
  return {
    soulDew: mergeStacks(primary.soulDew, secondary.soulDew, SOUL_DEW_MAX),
    machoBrace: mergeStacks(primary.machoBrace, secondary.machoBrace, MACHO_BRACE_MAX),
    vitamins: primary.vitamins.map((own, i) => mergeStacks(own, secondary.vitamins[i] ?? 0, ivs[i] ?? 0)),
    // With a stack of any size on either Pokémon, the fused one holds the item, and one is as good as two.
    sweetJuice: primary.sweetJuice || secondary.sweetJuice,
    foulJuice: primary.foulJuice || secondary.foulJuice,
    oldGateau: primary.oldGateau || secondary.oldGateau,
    eviolite: primary.eviolite || secondary.eviolite,
    species: SPECIES_ITEMS.map(item => item.id).filter(id => primary.species.includes(id) || secondary.species.includes(id)),
  };
}

/** One line per item the fused Pokémon holds, saying where it came from when the two Pokémon both mattered. */
export function fusedItemLines(
  primary: HeldItems,
  secondary: HeldItems,
  merged: HeldItems,
  ivs: readonly number[],
): string[] {
  const lines: string[] = [];
  const stack = (name: string, own: number, other: number, total: number, max: number) => {
    if (total === 0) return;
    let note = "";
    if (own > 0 && other > 0) note = total < own + other ? ` (${own} + ${other}, limit ${max})` : ` (${own} + ${other})`;
    else if (own === 0 && other > max) note = ` (from the secondary, above the primary's limit of ${max})`;
    else if (own === 0) note = " (from the secondary)";
    lines.push(`${name} ${total}${note}`);
  };
  stack("Soul Dew", primary.soulDew, secondary.soulDew, merged.soulDew, SOUL_DEW_MAX);
  stack("Macho Brace", primary.machoBrace, secondary.machoBrace, merged.machoBrace, MACHO_BRACE_MAX);
  VITAMIN_NAMES.forEach((name, i) => {
    stack(name, primary.vitamins[i] ?? 0, secondary.vitamins[i] ?? 0, merged.vitamins[i] ?? 0, ivs[i] ?? 0);
  });
  const single = (name: string, own: boolean, other: boolean) => {
    if (own || other) lines.push(own ? name : `${name} (from the secondary)`);
  };
  single("Sweet Shuckle Juice", primary.sweetJuice, secondary.sweetJuice);
  single("Foul Shuckle Juice", primary.foulJuice, secondary.foulJuice);
  single("Old Gateau", primary.oldGateau, secondary.oldGateau);
  single("Eviolite", primary.eviolite, secondary.eviolite);
  for (const item of SPECIES_ITEMS) {
    single(item.name, primary.species.includes(item.id), secondary.species.includes(item.id));
  }
  return lines;
}
