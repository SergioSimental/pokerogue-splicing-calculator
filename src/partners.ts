import { fuse, statAtLevel, type BaseStatItems, type HeldStatItems } from "./fuse.js";
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
  baseItems?: BaseStatItems;
  heldFor: (statIndex: number) => HeldStatItems;
  limit: number;
}

export interface Partner {
  secondary: Pokemon;
  types: PokemonType[];
  stats: number[];
  total: number;
  score: number;
}

/** Fuse the primary with every Pokémon in the dex and return the best partners first. */
export function rankPartners(primary: Pokemon, dex: Pokemon[], o: PartnerOptions): Partner[] {
  const out: Partner[] = [];
  for (const secondary of dex) {
    if (o.hideMax && secondary.isMax) continue;
    const f = fuse(primary, secondary, o.baseItems);
    if (o.type && !f.types.includes(o.type)) continue;
    const stats = f.stats.map((v, i) => statAtLevel(i, v, o.level, o.ivs[i] ?? 0, o.natureMultiplier(i), o.heldFor(i)));
    const total = stats.reduce((a, b) => a + b, 0);
    out.push({ secondary, types: f.types, stats, total, score: o.rankBy === "total" ? total : (stats[o.rankBy] ?? 0) });
  }
  return out.sort((a, b) => b.score - a.score || b.total - a.total || a.secondary.name.localeCompare(b.secondary.name)).slice(0, o.limit);
}
