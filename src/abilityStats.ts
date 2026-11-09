/**
 * Abilities that change a stat on their own, with no battle, weather, terrain, status, ally or HP condition,
 * checked against PokeRogue's source (init-abilities.ts, Pokemon.getEffectiveStat and Pokemon.calculateStats).
 * Everything that depends on the battle is left out on purpose.
 */
export interface AbilityStatEffect {
  /** Stat index (0 is HP) multiplied in battle, with the multiplier. */
  stat?: number;
  multiplier?: number;
  /** True when the ability sets the stored max HP to 1 (Wonder Guard). */
  hpIsOne?: boolean;
  /** Short text shown next to the ability. */
  note: string;
}

export const ABILITY_STAT_EFFECTS: Readonly<Record<string, AbilityStatEffect>> = {
  "Huge Power": { stat: 1, multiplier: 2, note: "Atk ×2 in battle" },
  "Pure Power": { stat: 1, multiplier: 2, note: "Atk ×2 in battle" },
  "Hustle": { stat: 1, multiplier: 1.5, note: "Atk ×1.5 in battle" },
  "Wonder Guard": { hpIsOne: true, note: "max HP is 1" },
};

/**
 * The abilities that are in effect: the fused Pokémon's ability plus the primary's passive once it is unlocked.
 * The game skips the passive when it is the same ability as the normal one (apply-ab-attrs.ts), so it never counts twice.
 */
export function activeAbilities(ability: string | undefined, passive: string | undefined, passiveUnlocked: boolean): string[] {
  const names = ability ? [ability] : [];
  if (passiveUnlocked && passive && passive !== ability) names.push(passive);
  return names;
}

/** The in-battle multiplier these abilities give one stat. Separate abilities multiply together. */
export function abilityMultiplier(statIndex: number, abilities: readonly string[]): number {
  let multiplier = 1;
  for (const name of abilities) {
    const effect = ABILITY_STAT_EFFECTS[name];
    if (effect?.stat === statIndex) multiplier *= effect.multiplier ?? 1;
  }
  return multiplier;
}

/** The short note shown next to an ability that changes a stat, or undefined for any other ability. */
export function abilityStatNote(name: string): string | undefined {
  return ABILITY_STAT_EFFECTS[name]?.note;
}

/** True when one of the abilities is Wonder Guard, which fixes the max HP at 1. */
export function hasHpIsOne(abilities: readonly string[]): boolean {
  return abilities.some(name => ABILITY_STAT_EFFECTS[name]?.hpIsOne === true);
}
