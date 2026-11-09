export const ABILITY_STAT_EFFECTS = {
    "Huge Power": { stat: 1, multiplier: 2, note: "Atk ×2 in battle" },
    "Pure Power": { stat: 1, multiplier: 2, note: "Atk ×2 in battle" },
    "Hustle": { stat: 1, multiplier: 1.5, note: "Atk ×1.5 in battle" },
    "Wonder Guard": { hpIsOne: true, note: "max HP is 1" },
};
/**
 * The abilities that are in effect: the fused Pokémon's ability plus the primary's passive once it is unlocked.
 * The game skips the passive when it is the same ability as the normal one (apply-ab-attrs.ts), so it never counts twice.
 */
export function activeAbilities(ability, passive, passiveUnlocked) {
    const names = ability ? [ability] : [];
    if (passiveUnlocked && passive && passive !== ability)
        names.push(passive);
    return names;
}
/** The in-battle multiplier these abilities give one stat. Separate abilities multiply together. */
export function abilityMultiplier(statIndex, abilities) {
    let multiplier = 1;
    for (const name of abilities) {
        const effect = ABILITY_STAT_EFFECTS[name];
        if (effect?.stat === statIndex)
            multiplier *= effect.multiplier ?? 1;
    }
    return multiplier;
}
/** The short note shown next to an ability that changes a stat, or undefined for any other ability. */
export function abilityStatNote(name) {
    return ABILITY_STAT_EFFECTS[name]?.note;
}
/** True when one of the abilities is Wonder Guard, which fixes the max HP at 1. */
export function hasHpIsOne(abilities) {
    return abilities.some(name => ABILITY_STAT_EFFECTS[name]?.hpIsOne === true);
}
