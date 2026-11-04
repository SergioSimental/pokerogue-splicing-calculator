/**
 * Fusion rules live here so they are easy to update if the game changes.
 * - Each base stat is the average of the primary and secondary Pokémon, rounded up.
 * - Primary type is the primary Pokémon's primary type.
 * - Secondary type is the secondary Pokémon's secondary type (or its primary if it has none),
 *   falling back to the primary Pokémon's secondary type when it would duplicate the primary type.
 */
export function fuse(primary, secondary) {
    const stats = primary.stats.map((v, i) => Math.ceil((v + (secondary.stats[i] ?? 0)) / 2));
    const primaryType = primary.types[0];
    let secondaryType = secondary.types[1] ?? secondary.types[0];
    if (secondaryType === primaryType)
        secondaryType = primary.types[1];
    const types = secondaryType ? [primaryType, secondaryType] : [primaryType];
    return { stats, types };
}
export const MIN_LEVEL = 1;
/** Not a game limit: just keeps the math within exact whole-number range. */
export const MAX_LEVEL = 1000000000000;
/** Clamp any input to a whole level between MIN_LEVEL and MAX_LEVEL. */
export function clampLevel(value) {
    if (!Number.isFinite(value))
        return MIN_LEVEL;
    return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.floor(value)));
}
/** Stack limits of the held items that change a stat, as in PokeRogue. */
export const SOUL_DEW_MAX = 10;
export const MACHO_BRACE_MAX = 50;
/** Whole stack count between 0 and max. */
function stacks(value, max) {
    const n = value ?? 0;
    return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
}
/**
 * The stat the game stores for a Pokémon at a given level (its permanent stat). Stat index 0 is HP.
 * Follows PokeRogue's Pokemon.calculateStats, in the same order and with the same rounding:
 *  1. Vitamins raise the base stat (after fusion): floor(base * (1 + stacks * 0.1)), at most IV stacks.
 *  2. HP:    floor((2 * base + iv) * level / 100) + level + 10
 *     Other: floor((2 * base + iv) * level / 100) + 5, then the nature multiplier (1.1, 0.9 or 1).
 *  3. Soul Dew widens a nature that is not neutral for this stat by 0.1 per stack.
 *     The nature step rounds up when it boosts the stat and down when it lowers it (never below 1).
 *  4. Macho Brace adds 2 HP or 1 of any other stat per stack, and at 50 stacks multiplies by 1.1 (HP) or 1.05.
 */
export function statAtLevel(statIndex, base, level, iv, nature = 1, held = {}) {
    const vitamin = stacks(held.vitamin, iv);
    const brace = stacks(held.machoBrace, MACHO_BRACE_MAX);
    const soulDew = stacks(held.soulDew, SOUL_DEW_MAX);
    const boosted = Math.floor(base * (1 + vitamin * 0.1));
    const core = Math.floor(((2 * boosted + iv) * level) / 100);
    if (statIndex === 0) {
        let hp = core + level + 10 + 2 * brace;
        if (brace === MACHO_BRACE_MAX)
            hp = Math.floor(hp * 1.1);
        return Math.max(hp, 1);
    }
    let value = core + 5;
    let multiplier = nature;
    if (multiplier !== 1)
        multiplier += 0.1 * soulDew * (multiplier > 1 ? 1 : -1);
    if (multiplier !== 1)
        value = Math.max(Math[multiplier > 1 ? "ceil" : "floor"](value * multiplier), 1);
    value += brace;
    if (brace === MACHO_BRACE_MAX)
        value = Math.floor(value * 1.05);
    return Math.max(value, 1);
}
export const MIN_IV = 0;
export const MAX_IV = 31;
/** Clamp any input to a whole IV between MIN_IV and MAX_IV. */
export function clampIv(value) {
    if (!Number.isFinite(value))
        return MIN_IV;
    return Math.min(MAX_IV, Math.max(MIN_IV, Math.floor(value)));
}
