import type { Fusion, Pokemon, PokemonType, Stats } from "./types.js";

/**
 * Fusion rules live here so they are easy to update if the game changes.
 * - Each base stat is the average of head and body, rounded up.
 * - Primary type is the head's primary type.
 * - Secondary type is the body's secondary type (or its primary if it has none),
 *   falling back to the head's secondary type when it would duplicate the primary.
 */
export function fuse(head: Pokemon, body: Pokemon): Fusion {
  const stats = head.stats.map((v, i) => Math.ceil((v + (body.stats[i] ?? 0)) / 2)) as Stats;
  const primary = head.types[0];
  let secondary: PokemonType | undefined = body.types[1] ?? body.types[0];
  if (secondary === primary) secondary = head.types[1];
  const types: PokemonType[] = secondary ? [primary, secondary] : [primary];
  return { stats, types };
}
