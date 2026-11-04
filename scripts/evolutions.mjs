/**
 * Whether a species can still evolve, read from its block in PokeRogue's species files.
 *
 * The game asks speciesDataRegistry.hasEvolutions(speciesId), which is "the evolutions list is not
 * empty". Every species block has exactly one `evolutions: [...]` list (after the forms, for species
 * that have forms), so anything else means the upstream format changed and the run should stop
 * instead of quietly treating every Pokémon as fully evolved. Kept in its own file (no side effects)
 * so tests can import it without running the update script.
 */
export function hasEvolutions(segment, id) {
  const lists = [...segment.matchAll(/\bevolutions:\s*\[/g)];
  if (lists.length !== 1) {
    throw new Error(`${id}: expected one evolutions list, found ${lists.length}. Did the upstream format change?`);
  }
  const [list] = lists;
  const after = segment.slice(list.index + list[0].length);
  // Some lists start with a comment (Tyrogue explains its custom evolution rule first).
  const first = after.replace(/^(?:\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*)*/, "");
  return !first.startsWith("]");
}
