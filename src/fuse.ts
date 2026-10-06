import type { Fusion, Pokemon, PokemonType, Stats } from "./types.js";

/**
 * Fusion rules live here so they are easy to update if the game changes.
 * - Each base stat is the average of the primary and secondary Pokémon, rounded up.
 * - Primary type is the primary Pokémon's primary type.
 * - Secondary type is the secondary Pokémon's secondary type (or its primary if it has none),
 *   falling back to the primary Pokémon's secondary type when it would duplicate the primary type.
 */
export function fuse(primary: Pokemon, secondary: Pokemon): Fusion {
  const stats = primary.stats.map((v, i) => Math.ceil((v + (secondary.stats[i] ?? 0)) / 2)) as Stats;
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

/**
 * Stat at a given level. Stat index 0 is HP.
 * HP:    floor((2 * base + iv) * level / 100) + level + 10
 * Other: floor(floor((2 * base + iv) * level / 100) + 5) * nature) where nature is 1.1, 0.9 or 1
 */
export function statAtLevel(statIndex: number, base: number, level: number, iv: number, nature = 1): number {
  const core = Math.floor(((2 * base + iv) * level) / 100);
  if (statIndex === 0) return core + level + 10;
  return Math.floor((core + 5) * nature);
}

export const MIN_IV = 0;
export const MAX_IV = 31;

/** Clamp any input to a whole IV between MIN_IV and MAX_IV. */
export function clampIv(value: number): number {
  if (!Number.isFinite(value)) return MIN_IV;
  return Math.min(MAX_IV, Math.max(MIN_IV, Math.floor(value)));
}
