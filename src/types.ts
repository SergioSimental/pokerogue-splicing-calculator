export const STAT_NAMES = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"] as const;

/** Base stats in STAT_NAMES order. */
export type Stats = [number, number, number, number, number, number];

export type PokemonType =
  | "Normal" | "Fire" | "Water" | "Electric" | "Grass" | "Ice"
  | "Fighting" | "Poison" | "Ground" | "Flying" | "Psychic" | "Bug"
  | "Rock" | "Ghost" | "Dragon" | "Dark" | "Steel" | "Fairy";

/** A species' (or form's) regular ability pool and its hidden ability, as listed in PokeRogue. */
export interface Abilities {
  /** One or two regular abilities (an empty second slot is left out). */
  regular: string[];
  /** The hidden ability, or null when the species has none. It can repeat a regular ability. */
  hidden: string | null;
}

export interface Pokemon {
  name: string;
  stats: Stats;
  types: [PokemonType] | [PokemonType, PokemonType];
  /** The passive ability this species (or form) has in PokeRogue. */
  passive: string;
  abilities: Abilities;
}

export interface Fusion {
  stats: Stats;
  types: PokemonType[];
}
