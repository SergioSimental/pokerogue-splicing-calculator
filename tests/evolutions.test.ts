import { describe, expect, it } from "vitest";
import { hasEvolutions } from "../scripts/evolutions.mjs";

describe("hasEvolutions", () => {
  it("is false for an empty list", () => {
    expect(hasEvolutions("    evolutions: [],\n    other: 1", "VENUSAUR")).toBe(false);
    expect(hasEvolutions("evolutions: [\n    ],", "VENUSAUR")).toBe(false);
  });

  it("is true for a list with an evolution", () => {
    expect(hasEvolutions("evolutions: [new SpeciesEvolution({ speciesId: SpeciesId.IVYSAUR, level: 16 })],", "BULBASAUR")).toBe(true);
    expect(hasEvolutions("evolutions: [\n  new SpeciesFormEvolution({ speciesId: SpeciesId.RAICHU }),\n],", "PIKACHU")).toBe(true);
  });

  it("finds the list after the forms, where species with forms keep it", () => {
    const segment = "head: 1, new PokemonForm({ formKey: 'mega' }), new PokemonForm({ x: 1 }),\n  evolutions: [],\n";
    expect(hasEvolutions(segment, "VENUSAUR")).toBe(false);
  });

  it("looks past a leading comment (Tyrogue explains its evolution before listing it)", () => {
    const tyrogue = "evolutions: [\n  /*\n   * Custom: evolves at level 20\n   */\n  new SpeciesEvolution({ speciesId: SpeciesId.HITMONLEE }),\n],";
    expect(hasEvolutions(tyrogue, "TYROGUE")).toBe(true);
    expect(hasEvolutions("evolutions: [ // nothing yet\n ],", "X")).toBe(false);
  });

  it("stops with a clear error when the list is missing or appears twice, instead of guessing", () => {
    expect(() => hasEvolutions("no list here", "MISSINGNO")).toThrow(/MISSINGNO: expected one evolutions list, found 0/);
    expect(() => hasEvolutions("evolutions: [], evolutions: []", "TWICE")).toThrow(/TWICE: expected one evolutions list, found 2/);
  });
});
