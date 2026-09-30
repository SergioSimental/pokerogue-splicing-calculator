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
