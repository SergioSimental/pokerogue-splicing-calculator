import { fuse, statAtLevel } from "./fuse.js";
import { abilityChoices } from "./abilities.js";
import { ABILITY_STAT_EFFECTS, abilityMultiplier, activeAbilities, hasHpIsOne } from "./abilityStats.js";
import { battleStat } from "./heldItems.js";
import { STAT_NAMES } from "./types.js";
/** The abilities counted for a chosen ability: it, plus the primary's passive once unlocked (never twice). */
export function countedAbilities(ability, passive, passiveUnlocked) {
    return ability ? activeAbilities(ability, passive, passiveUnlocked === true) : [];
}
/**
 * One line saying which stat-changing abilities the list counted, or undefined when there are none
 * (no ability chosen, or an ability and passive that leave the stats alone).
 */
export function countedNote(ability, passive, passiveUnlocked) {
    const names = countedAbilities(ability, passive, passiveUnlocked);
    const effects = names.filter(name => ABILITY_STAT_EFFECTS[name]);
    if (effects.length === 0)
        return undefined;
    const describe = (name) => `${name} (${ABILITY_STAT_EFFECTS[name]?.note})`;
    const parts = effects.map(name => (name === ability ? describe(name) : `the primary's passive, ${describe(name)}`));
    let note = `Counting ${parts.join(" and ")}.`;
    // Two abilities on the same stat multiply, as in the game.
    const stat = ABILITY_STAT_EFFECTS[effects[0] ?? ""]?.stat;
    if (effects.length > 1 && stat !== undefined && effects.every(name => ABILITY_STAT_EFFECTS[name]?.stat === stat)) {
        note += ` Together: ${STAT_NAMES[stat]} ×${abilityMultiplier(stat, effects)} in battle.`;
    }
    return note;
}
/** Fuse the primary with every Pokémon in the dex and return the best partners first. */
export function rankPartners(primary, dex, o) {
    const out = [];
    const counted = countedAbilities(o.ability, o.passive, o.passiveUnlocked);
    const hpIsOne = hasHpIsOne(counted);
    for (const secondary of dex) {
        if (o.hideMax && secondary.isMax)
            continue;
        if (o.hideMega && secondary.isMega)
            continue;
        if (o.hideSpecial && secondary.isSpecial)
            continue;
        const abilities = abilityChoices(secondary);
        if (o.ability && !abilities.some(a => a.name === o.ability))
            continue;
        const f = fuse(primary, secondary, o.baseItems);
        if (o.type && !f.types.includes(o.type))
            continue;
        const stats = f.stats.map((v, i) => {
            const held = o.heldFor(i);
            const permanent = statAtLevel(i, v, o.level, o.ivs[i] ?? 0, o.natureMultiplier(i), hpIsOne ? { ...held, hpIsOne } : held);
            return counted.length === 0 ? permanent : battleStat(permanent, abilityMultiplier(i, counted));
        });
        const total = stats.reduce((a, b) => a + b, 0);
        out.push({ secondary, types: f.types, abilities, stats, total, score: o.rankBy === "total" ? total : (stats[o.rankBy] ?? 0) });
    }
    return out.sort((a, b) => b.score - a.score || b.total - a.total || a.secondary.name.localeCompare(b.secondary.name)).slice(0, o.limit);
}
