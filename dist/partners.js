import { fuse, statAtLevel } from "./fuse.js";
/** Mega forms are named "X (Mega)", "X (Mega X)", "X (Mega Curly)" and so on; species like Meganium never have the bracket. */
export function isMegaForm(pokemon) {
    return /\(Mega( [^)]+)?\)$/.test(pokemon.name);
}
/**
 * Any other alternate form, which the data names with a bracket (Primal, Ultra, Origin Forme, Therian Forme, Terastal ...).
 * Mega and Max forms have their own filters, and regional forms such as Alolan Marowak carry no bracket, so they stay.
 */
export function isSpecialForm(pokemon) {
    return /\(.+\)$/.test(pokemon.name) && !pokemon.isMax && !isMegaForm(pokemon);
}
/** Fuse the primary with every Pokémon in the dex and return the best partners first. */
export function rankPartners(primary, dex, o) {
    const out = [];
    for (const secondary of dex) {
        if (o.hideMax && secondary.isMax)
            continue;
        if (o.hideMega && isMegaForm(secondary))
            continue;
        if (o.hideSpecial && isSpecialForm(secondary))
            continue;
        const f = fuse(primary, secondary, o.baseItems);
        if (o.type && !f.types.includes(o.type))
            continue;
        const stats = f.stats.map((v, i) => statAtLevel(i, v, o.level, o.ivs[i] ?? 0, o.natureMultiplier(i), o.heldFor(i)));
        const total = stats.reduce((a, b) => a + b, 0);
        out.push({ secondary, types: f.types, stats, total, score: o.rankBy === "total" ? total : (stats[o.rankBy] ?? 0) });
    }
    return out.sort((a, b) => b.score - a.score || b.total - a.total || a.secondary.name.localeCompare(b.secondary.name)).slice(0, o.limit);
}
