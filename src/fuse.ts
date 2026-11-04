import type { Fusion, Pokemon, PokemonType, Stats } from "./types.js";

/** Held items that change a Pokémon's own base stats. They matter only while the primary Pokémon's stats are worked out. */
export interface BaseStatItems {
  /** Sweet Shuckle Juice: +10 to every base stat (+5 for HP). */
  sweetJuice?: boolean;
  /** Foul Shuckle Juice: -15 to every base stat (-7.5 for HP, rounded down). */
  foulJuice?: boolean;
  /** Old Gateau: +20 to the lower of HP/Spe, the lower of Atk/SpA and the lower of Def/SpD. */
  oldGateau?: boolean;
}

/** PokeRogue clamps base stats changed by these items to this range. */
const BASE_STAT_MIN = 1;
const BASE_STAT_MAX = 999999;

/**
 * A Pokémon's own base stats after its base-stat items, as in PokeRogue's Pokemon.calculateBaseStats: Shuckle Juice
 * first, then Old Gateau. Neither depends on how many stacks are held (the game applies each item once), and
 * every changed stat stays between 1 and 999,999. Ties for "lower" go to Spe, SpA and SpD, as in the game.
 */
export function adjustedBaseStats(base: Stats, items: BaseStatItems = {}): Stats {
  const stats = [...base] as Stats;
  const clamp = (v: number) => Math.min(Math.max(v, BASE_STAT_MIN), BASE_STAT_MAX);
  const shuckle = (amount: number) => {
    stats.forEach((v, i) => {
      stats[i] = clamp(Math.floor(i === 0 ? v + amount / 2 : v + amount));
    });
  };
  if (items.sweetJuice) shuckle(10);
  if (items.foulJuice) shuckle(-15);
  if (items.oldGateau) {
    // The lower stat of each pair is picked from the original base stats, before the juice above.
    const picks = [
      base[0] < base[5] ? 0 : 5,
      base[1] < base[3] ? 1 : 3,
      base[2] < base[4] ? 2 : 4,
    ];
    for (const i of picks) stats[i] = clamp(Math.floor((stats[i] ?? 0) + 20));
  }
  return stats;
}

/**
 * Fusion rules live here so they are easy to update if the game changes.
 * - Each base stat is the average of the primary and secondary Pokémon, rounded up. Shuckle Juice and Old Gateau
 *   change the primary Pokémon's own base stats first, before they are averaged (the secondary's are untouched).
 * - Primary type is the primary Pokémon's primary type.
 * - Secondary type is the secondary Pokémon's secondary type (or its primary if it has none),
 *   falling back to the primary Pokémon's secondary type when it would duplicate the primary type.
 */
export function fuse(primary: Pokemon, secondary: Pokemon, baseItems: BaseStatItems = {}): Fusion {
  const stats = adjustedBaseStats(primary.stats, baseItems).map((v, i) => Math.ceil((v + (secondary.stats[i] ?? 0)) / 2)) as Stats;
  const primaryType = primary.types[0];
  let secondaryType: PokemonType | undefined = secondary.types[1] ?? secondary.types[0];
  if (secondaryType === primaryType) secondaryType = primary.types[1];
  const types: PokemonType[] = secondaryType ? [primaryType, secondaryType] : [primaryType];
  return { stats, types };
}

export const MIN_LEVEL = 1;
/** Not a game limit: just keeps the math within exact whole-number range. */
export const MAX_LEVEL = 1_000_000_000_000;

/** Clamp any input to a whole level between MIN_LEVEL and MAX_LEVEL. */
export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return MIN_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(value)));
}

/** Stack limits of the held items that change a stat, as in PokeRogue. */
export const SOUL_DEW_MAX = 10;
export const MACHO_BRACE_MAX = 50;

/** Held items that change the permanent stat. Each number is a stack count for the stat being worked out. */
export interface HeldStatItems {
  /**
   * The vitamin stacks held for this stat (HP Up for HP, Protein for Atk, ...). A Pokémon can only hold as many
   * as that stat's IV, but the stat formula itself counts whatever it is given, as in the game.
   */
  vitamin?: number;
  machoBrace?: number;
  soulDew?: number;
}

/** Whole stack count between 0 and max. */
function stacks(value: number | undefined, max: number): number {
  const n = value ?? 0;
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
}

/**
 * The stat the game stores for a Pokémon at a given level (its permanent stat). Stat index 0 is HP.
 * Follows PokeRogue's Pokemon.calculateStats, in the same order and with the same rounding:
 *  1. Vitamins raise the base stat (after fusion): floor(base * (1 + stacks * 0.1)).
 *  2. HP:    floor((2 * base + iv) * level / 100) + level + 10
 *     Other: floor((2 * base + iv) * level / 100) + 5, then the nature multiplier (1.1, 0.9 or 1).
 *  3. Soul Dew widens a nature that is not neutral for this stat by 0.1 per stack.
 *     The nature step rounds up when it boosts the stat and down when it lowers it (never below 1).
 *  4. Macho Brace adds 2 HP or 1 of any other stat per stack, and at 50 stacks multiplies by 1.1 (HP) or 1.05.
 */
export function statAtLevel(
  statIndex: number,
  base: number,
  level: number,
  iv: number,
  nature = 1,
  held: HeldStatItems = {},
): number {
  const vitamin = stacks(held.vitamin, MAX_IV);
  const brace = stacks(held.machoBrace, MACHO_BRACE_MAX);
  const soulDew = stacks(held.soulDew, SOUL_DEW_MAX);
  const boosted = Math.floor(base * (1 + vitamin * 0.1));
  const core = Math.floor(((2 * boosted + iv) * level) / 100);

  if (statIndex === 0) {
    let hp = core + level + 10 + 2 * brace;
    if (brace === MACHO_BRACE_MAX) hp = Math.floor(hp * 1.1);
    return Math.max(hp, 1);
  }

  let value = core + 5;
  let multiplier = nature;
  if (multiplier !== 1) multiplier += 0.1 * soulDew * (multiplier > 1 ? 1 : -1);
  if (multiplier !== 1) value = Math.max(Math[multiplier > 1 ? "ceil" : "floor"](value * multiplier), 1);
  value += brace;
  if (brace === MACHO_BRACE_MAX) value = Math.floor(value * 1.05);
  return Math.max(value, 1);
}

export const MIN_IV = 0;
export const MAX_IV = 31;

/** Clamp any input to a whole IV between MIN_IV and MAX_IV. */
export function clampIv(value: number): number {
  if (!Number.isFinite(value)) return MIN_IV;
  return Math.min(MAX_IV, Math.max(MIN_IV, Math.floor(value)));
}
