import { fuse, statAtLevel, type BaseStatItems, type HeldStatItems } from "./fuse.js";
import { abilityChoices, type AbilityChoice } from "./abilities.js";
import type { Pokemon, PokemonType } from "./types.js";

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

/** Fuse the primary with every Pokémon in the dex and return the best partners first. */
export function rankPartners(primary: Pokemon, dex: Pokemon[], o: PartnerOptions): Partner[] {
  const out: Partner[] = [];
  for (const secondary of dex) {
    if (o.hideMax && secondary.isMax) continue;
    if (o.hideMega && secondary.isMega) continue;
    if (o.hideSpecial && secondary.isSpecial) continue;
    const abilities = abilityChoices(secondary);
    if (o.ability && !abilities.some(a => a.name === o.ability)) continue;
    const f = fuse(primary, secondary, o.baseItems);
    if (o.type && !f.types.includes(o.type)) continue;
    const stats = f.stats.map((v, i) => statAtLevel(i, v, o.level, o.ivs[i] ?? 0, o.natureMultiplier(i), o.heldFor(i)));
    const total = stats.reduce((a, b) => a + b, 0);
    out.push({ secondary, types: f.types, abilities, stats, total, score: o.rankBy === "total" ? total : (stats[o.rankBy] ?? 0) });
  }
  return out.sort((a, b) => b.score - a.score || b.total - a.total || a.secondary.name.localeCompare(b.secondary.name)).slice(0, o.limit);
}
