import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fusedSpeciesName } from "../src/fusionName.js";
import type { Pokemon } from "../src/types.js";

// Expected values below were produced by running PokeRogue's own getFusedSpeciesName() (from its
// src/utils/pokemon-utils.ts) on the same inputs, not worked out by hand. Some results look odd
// (Charizard + Garchomp = "Champ"); that is the game's rule, which this port reproduces on purpose.
const GAME_RESULTS: [string, string, string][] = [
  ["Charizard", "Garchomp", "Champ"],
  ["Garchomp", "Charizard", "Garchorizard"],
  ["Bulbasaur", "Charmander", "Bulbarmander"],
  ["Magikarp", "Gyarados", "Magirados"],
  ["Eevee", "Vaporeon", "Eeveereon"],
  ["Ditto", "Ditto", "Dittotto"],
  ["Mew", "Mewtwo", "Mewtwo"],
  ["Raichu", "Garchomp", "Raimp"],
  ["Nidoran♀", "Nidoran♂", "Nidoran♂"],
  ["Farfetch’d", "Sirfetch’d", "Farfetch’d"],
  // The game trims a repeated letter where the two halves meet: a vowel (a, i, u) is dropped...
  ["Bulbasaur", "Horsea", "Bulba"],
  ["Bulbasaur", "Kirlia", "Bulba"],
  ["Venusaur", "Furfrou", "Venu"],
  ["Golduck", "Furfrou", "Goldu"],
  // ...and any other repeated letter is skipped up to the next different one.
  ["Garchomp", "Umbreon", "Garchon"],
  ["Garchomp", "Jolteon", "Garchon"],
  // A trailing "y" counts as a vowel when finding where to cut.
  ["Ivysaur", "Bulbasaur", "Ivysaur"],
  // A hyphen in the secondary name is kept.
  ["Bulbasaur", "Ho-Oh", "Bulba-Oh"],
  ["Bulbasaur", "Ting-Lu", "Bulbang-Lu"],
  // Names with a space, hyphen or punctuation.
  ["Mr. Mime", "Ho-Oh", "Mr. Mime-Oh"],
  ["Ho-Oh", "Mr. Mime", "Mr. Ho-Ome"],
  ["Tapu Koko", "Type: Null", "Tapu Kokonull"],
  // The game's special case for Rapidash ("Rapi" becomes "Rapid")...
  ["Rapidash", "Ekans", "Rapidns"],
  ["Rapidash", "Arbok", "Rapidk"],
  // ...and its extra fix when the second half would be just "ng" (these four pin that branch).
  ["Rapidash", "Dewgong", "Rapidong"],
  ["Rapidash", "Koffing", "Rapiding"],
  ["Rapidash", "Metang", "Rapidang"],
  ["Rapidash", "Klang", "Rapidang"],
  // The game cuts by the regex result's length, not the text's length (a quirk kept for parity).
  // These differ from what a "cleaner" slice(-1) would give: Bulba, Bulbay and Bulbao.
  ["Bulbasaur", "Abra", "Bulbara"],
  ["Bulbasaur", "Gastly", "Bulbastly"],
  ["Bulbasaur", "Hypno", "Bulbapno"],
  // Mega / G-Max / Primal / E-Max wrappers: the prefix and suffix are kept around the fused part.
  ["Mega Charizard X", "Garchomp", "Mega Champ X"],
  ["Garchomp", "Mega Charizard X", "Mega Garchorizard X"],
  ["Mega Charizard X", "G-Max Venusaur", "Mega Chasaur X"],
  ["Primal Kyogre", "Groudon", "Primal Kyoudon"],
  ["E-Max Eternatus", "Dragonite", "E-Max Etegonite"],
];

describe("fusedSpeciesName (port of PokeRogue's getFusedSpeciesName)", () => {
  it.each(GAME_RESULTS)("%s + %s = %s", (a, b, expected) => {
    expect(fusedSpeciesName(a, b)).toBe(expected);
  });

  it("keeps a Mega/G-Max/Primal prefix and an X/Y/Z suffix from the inputs", () => {
    expect(fusedSpeciesName("Mega Charizard X", "Garchomp")).toMatch(/^Mega .* X$/);
    expect(fusedSpeciesName("Garchomp", "G-Max Venusaur")).toMatch(/^G-Max /);
  });

  it("never throws and always returns some text, for every name in the data", () => {
    const dex = JSON.parse(readFileSync(new URL("../data/pokemon.json", import.meta.url), "utf8")) as Pokemon[];
    const names = [...new Set(dex.map(p => p.fusionName))];
    for (const name of names) {
      for (const other of ["Garchomp", "Mr. Mime", "Mega Charizard X"]) {
        for (const result of [fusedSpeciesName(name, other), fusedSpeciesName(other, name)]) {
          expect(typeof result, `${name} / ${other}`).toBe("string");
          expect(result.trim(), `${name} / ${other}`).not.toBe("");
        }
      }
    }
  });
});
