/**
 * Reads the regular and hidden abilities from one species/form block of PokeRogue's source.
 * Kept in its own file (no side effects) so tests can import it without running the update script.
 *
 * Upstream lists ability1, ability2 and abilityHidden on every block, using AbilityId.NONE for an
 * empty slot. Parsing is tolerant where a guess is safe and strict where it is not:
 *  - a missing ability2 or abilityHidden is treated as an empty slot, with a warning;
 *  - a missing ability1 throws, because a Pokémon with no regular ability means the parse is wrong.
 * (The update script also fails the whole run if the finished data looks implausible, so a format
 * change that breaks these lookups everywhere cannot be written out silently.)
 *
 * Returns { regular: [1-2 distinct names], hidden: name | null }.
 */
export function readAbilities(block, label, nameOf, warn = console.warn) {
  const idOf = key => {
    const m = block.match(new RegExp(`\\b${key}:\\s*AbilityId\\.(\\w+)`));
    return m ? m[1] : null;
  };

  const first = idOf("ability1");
  if (first === null) throw new Error(`${label}: no ability1 found. Did the upstream format change?`);

  let second = idOf("ability2");
  if (second === null) {
    warn(`${label}: no ability2 found, treating it as empty`);
    second = "NONE";
  }

  let hiddenId = idOf("abilityHidden");
  if (hiddenId === null) {
    warn(`${label}: no abilityHidden found, treating it as empty`);
    hiddenId = "NONE";
  }

  const regularIds = [];
  for (const id of [first, second]) {
    if (id !== "NONE" && !regularIds.includes(id)) regularIds.push(id);
  }
  if (regularIds.length === 0) warn(`${label}: no regular abilities parsed (block may be malformed)`);

  return { regular: regularIds.map(nameOf), hidden: hiddenId === "NONE" ? null : nameOf(hiddenId) };
}
