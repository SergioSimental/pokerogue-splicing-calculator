export const STAT_NAMES = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"] as const;

/** Base stats in STAT_NAMES order. */
export type Stats = [number, number, number, number, number, number];

export type PokemonType =
  | "Normal" | "Fire" | "Water" | "Electric" | "Grass" | "Ice"
  | "Fighting" | "Poison" | "Ground" | "Flying" | "Psychic" | "Bug"
  | "Rock" | "Ghost" | "Dragon" | "Dark" | "Steel" | "Fairy";

export interface Pokemon {
  name: string;
  stats: Stats;
  types: [PokemonType] | [PokemonType, PokemonType];
}

export interface Fusion {
  stats: Stats;
  types: PokemonType[];
}
