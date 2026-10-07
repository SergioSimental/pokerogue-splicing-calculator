import { STAT_NAMES } from "./types.js";

/** Stat indexes follow STAT_NAMES: 0 HP, 1 Atk, 2 Def, 3 SpA, 4 SpD, 5 Spe. HP is never affected. */
export interface Nature {
  name: string;
  up?: number;
  down?: number;
}

/** The 25 natures, in the same order as PokeRogue's Nature enum (src/data/nature.ts). */
export const NATURES: readonly Nature[] = [
  { name: "Hardy" },
  { name: "Lonely", up: 1, down: 2 },
  { name: "Brave", up: 1, down: 5 },
  { name: "Adamant", up: 1, down: 3 },
  { name: "Naughty", up: 1, down: 4 },
  { name: "Bold", up: 2, down: 1 },
  { name: "Docile" },
  { name: "Relaxed", up: 2, down: 5 },
  { name: "Impish", up: 2, down: 3 },
  { name: "Lax", up: 2, down: 4 },
  { name: "Timid", up: 5, down: 1 },
  { name: "Hasty", up: 5, down: 2 },
  { name: "Serious" },
  { name: "Jolly", up: 5, down: 3 },
  { name: "Naive", up: 5, down: 4 },
  { name: "Modest", up: 3, down: 1 },
  { name: "Mild", up: 3, down: 2 },
  { name: "Quiet", up: 3, down: 5 },
  { name: "Bashful" },
  { name: "Rash", up: 3, down: 4 },
  { name: "Calm", up: 4, down: 1 },
  { name: "Gentle", up: 4, down: 2 },
  { name: "Sassy", up: 4, down: 5 },
  { name: "Careful", up: 4, down: 3 },
  { name: "Quirky" },
];

export function natureLabel(n: Nature): string {
  if (n.up === undefined || n.down === undefined) return `${n.name} (neutral)`;
  return `${n.name} (+${STAT_NAMES[n.up]}, -${STAT_NAMES[n.down]})`;
}

export function natureMultiplier(n: Nature | undefined, statIndex: number): number {
  if (!n) return 1;
  if (n.up === statIndex) return 1.1;
  if (n.down === statIndex) return 0.9;
  return 1;
}
