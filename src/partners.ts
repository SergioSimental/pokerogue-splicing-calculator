import { fuse, statAtLevel, type BaseStatItems, type HeldStatItems } from "./fuse.js";
import { abilityChoices, type AbilityChoice } from "./abilities.js";
import { ABILITY_STAT_EFFECTS, abilityMultiplier, activeAbilities, hasHpIsOne } from "./abilityStats.js";
import { battleStat } from "./heldItems.js";
import { STAT_NAMES, type Pokemon, type PokemonType } from "./types.js";

export interface PartnerOptions {
  level: number;
  ivs: number[];
  natureMultiplier: (statIndex: number) => number;
  /** Stat to rank by (0-5), or "total". */
  rankBy: number | "total";
  /** Keep only partners whose fused Pokémon has this type. */
  type?: PokemonType;
  hideMax?: boolean;
  hideMega?: boolean;
  hideSpecial?: boolean;
  /** Keep only partners that can give this ability (a fused Pokémon takes its ability from the secondary). */
  ability?: string;
  /**
   * With an ability chosen, the stats count what that ability does (and the primary's passive, when it is unlocked),
   * the same way the result card does. Without one, the stored stats are ranked and these two are not used.
   */
  passive?: string;
  passiveUnlocked?: boolean;
  baseItems?: BaseStatItems;
  heldFor: (statIndex: number) => HeldStatItems;
  limit: number;
}

export interface Partner {
  secondary: Pokemon;
  types: PokemonType[];
  /** The abilities this partner can give the fusion: its regular ones, then its hidden one. */
  abilities: AbilityChoice[];
  stats: number[];
  total: number;
  score: number;
}

/** The abilities counted for a chosen ability: it, plus the primary's passive once unlocked (never twice). */
export function countedAbilities(ability: string | undefined, passive: string | undefined, passiveUnlocked: boolean | undefined): string[] {
  return ability ? activeAbilities(ability, passive, passiveUnlocked === true) : [];
}

/**
 * One line saying which stat-changing abilities the list counted, or undefined when there are none
 * (no ability chosen, or an ability and passive that leave the stats alone).
 */
export function countedNote(ability: string | undefined, passive: string | undefined, passiveUnlocked: boolean | undefined): string | undefined {
  const names = countedAbilities(ability, passive, passiveUnlocked);
  const effects = names.filter(name => ABILITY_STAT_EFFECTS[name]);
  if (effects.length === 0) return undefined;
  const describe = (name: string) => `${name} (${ABILITY_STAT_EFFECTS[name]?.note})`;
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
export function rankPartners(primary: Pokemon, dex: Pokemon[], o: PartnerOptions): Partner[] {
  const out: Partner[] = [];
  const counted = countedAbilities(o.ability, o.passive, o.passiveUnlocked);
  const hpIsOne = hasHpIsOne(counted);
  for (const secondary of dex) {
    if (o.hideMax && secondary.isMax) continue;
    if (o.hideMega && secondary.isMega) continue;
    if (o.hideSpecial && secondary.isSpecial) continue;
    const abilities = abilityChoices(secondary);
    if (o.ability && !abilities.some(a => a.name === o.ability)) continue;
    const f = fuse(primary, secondary, o.baseItems);
    if (o.type && !f.types.includes(o.type)) continue;
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
