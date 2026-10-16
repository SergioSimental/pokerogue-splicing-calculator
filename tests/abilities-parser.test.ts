import { describe, expect, it, vi } from "vitest";
import { readAbilities } from "../scripts/abilities-parser.mjs";

const nameOf = (id: string) => id.toLowerCase();

describe("readAbilities", () => {
  it("reads two regular abilities and a hidden one from an upstream-style block", () => {
    const block = `
      type1: PokemonType.PSYCHIC,
      ability1: AbilityId.SOUNDPROOF,
      ability2: AbilityId.FILTER,
      abilityHidden: AbilityId.TECHNICIAN,
      baseTotal: 460,`;
    expect(readAbilities(block, "Mr. Mime", nameOf)).toEqual({ regular: ["soundproof", "filter"], hidden: "technician" });
  });

  it("treats AbilityId.NONE as an empty slot", () => {
    const block = `ability1: AbilityId.WONDER_GUARD,\nability2: AbilityId.NONE,\nabilityHidden: AbilityId.NONE,`;
    expect(readAbilities(block, "Shedinja", nameOf)).toEqual({ regular: ["wonder_guard"], hidden: null });
  });

  it("lists a repeated regular ability once", () => {
    const block = `ability1: AbilityId.STURDY,\nability2: AbilityId.STURDY,\nabilityHidden: AbilityId.NONE,`;
    expect(readAbilities(block, "Test", nameOf).regular).toEqual(["sturdy"]);
  });

  it("copes with different spacing", () => {
    const block = `ability1:AbilityId.A,   ability2:   AbilityId.B ,\nabilityHidden:\tAbilityId.C`;
    expect(readAbilities(block, "Test", nameOf)).toEqual({ regular: ["a", "b"], hidden: "c" });
  });

  it("does not match a longer key that merely ends in the same letters", () => {
    const block = `fusionability1: AbilityId.WRONG,\nability1: AbilityId.RIGHT,\nability2: AbilityId.NONE,\nabilityHidden: AbilityId.NONE,`;
    expect(readAbilities(block, "Test", nameOf).regular).toEqual(["right"]);
  });

  it("does not throw when ability2 is missing: one regular ability, plus a warning naming the Pokémon", () => {
    const warn = vi.fn();
    const block = `ability1: AbilityId.SOUNDPROOF,\nabilityHidden: AbilityId.NONE,`;
    const result = readAbilities(block, "TestMon", nameOf, warn);
    expect(result).toEqual({ regular: ["soundproof"], hidden: null });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("TestMon");
    expect(warn.mock.calls[0]?.[0]).toContain("ability2");
  });

  it("does not throw when abilityHidden is missing: hidden is null, plus a warning", () => {
    const warn = vi.fn();
    const block = `ability1: AbilityId.A,\nability2: AbilityId.B,`;
    const result = readAbilities(block, "TestMon", nameOf, warn);
    expect(result).toEqual({ regular: ["a", "b"], hidden: null });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("abilityHidden");
  });

  it("stays quiet when nothing is missing", () => {
    const warn = vi.fn();
    readAbilities(`ability1: AbilityId.A,\nability2: AbilityId.NONE,\nabilityHidden: AbilityId.B,`, "Test", nameOf, warn);
    expect(warn).not.toHaveBeenCalled();
  });

  it("still throws, naming the Pokémon, when ability1 is missing (the parse is wrong, not just sparse)", () => {
    const block = `ability2: AbilityId.B,\nabilityHidden: AbilityId.C,`;
    expect(() => readAbilities(block, "BrokenMon", nameOf, vi.fn())).toThrow(/BrokenMon.*ability1/);
  });
});
