/**
 * The abilities a fusion can take from this Pokémon. In PokeRogue a fused Pokémon gets its
 * ability from its secondary (fused) Pokémon, so these are the secondary's regular abilities
 * followed by its hidden ability. A hidden ability that just repeats a regular one is left out,
 * because choosing it would give the same result.
 */
export function abilityChoices(p) {
    const { regular, hidden } = p.abilities;
    const choices = regular.map(name => ({ name, hidden: false, label: name }));
    if (hidden !== null && !regular.includes(hidden)) {
        choices.push({ name: hidden, hidden: true, label: `${hidden} (Hidden)` });
    }
    return choices;
}
