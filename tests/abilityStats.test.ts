import { describe, expect, it } from "vitest";
import { abilityMultiplier, abilityStatNote, activeAbilities, hasHpIsOne } from "../src/abilityStats.js";
import { battleMultiplier } from "../src/heldItems.js";
import { statAtLevel } from "../src/fuse.js";
import type { Pokemon } from "../src/types.js";

const mon = (name: string): Pokemon => ({
  name, stats: [50, 50, 50, 50, 50, 50], types: ["Normal"], passive: "", abilities: { regular: [], hidden: null },
  fusionName: name, canEvolve: false, isMax: false,
});

describe("activeAbilities", () => {
  it("adds the passive only when it is unlocked and is a different ability", () => {
    expect(activeAbilities("Huge Power", "Hustle", true)).toEqual(["Huge Power", "Hustle"]);
    expect(activeAbilities("Huge Power", "Hustle", false)).toEqual(["Huge Power"]);
    expect(activeAbilities("Huge Power", "Huge Power", true)).toEqual(["Huge Power"]);
    expect(activeAbilities(undefined, "Hustle", true)).toEqual(["Hustle"]);
    expect(activeAbilities(undefined, undefined, true)).toEqual([]);
  });
});

describe("abilityMultiplier", () => {
  it("doubles Atk for Huge Power and Pure Power, and takes 1.5 for Hustle", () => {
    expect(abilityMultiplier(1, ["Huge Power"])).toBe(2);
    expect(abilityMultiplier(1, ["Pure Power"])).toBe(2);
    expect(abilityMultiplier(1, ["Hustle"])).toBe(1.5);
  });

  it("only changes Atk", () => {
    for (const stat of [0, 2, 3, 4, 5]) expect(abilityMultiplier(stat, ["Huge Power", "Hustle"]), `stat ${stat}`).toBe(1);
  });

  it("multiplies separate abilities together and ignores every other ability", () => {
    expect(abilityMultiplier(1, ["Huge Power", "Hustle"])).toBe(3);
    // Conditional abilities are left out on purpose: they depend on weather, terrain, status, HP or allies.
    for (const name of ["Guts", "Swift Swim", "Chlorophyll", "Marvel Scale", "Defeatist", "Plus", "Solar Power"]) {
      expect(abilityMultiplier(1, [name]), name).toBe(1);
      expect(abilityMultiplier(5, [name]), name).toBe(1);
      expect(abilityStatNote(name), name).toBeUndefined();
    }
  });
});

describe("Wonder Guard", () => {
  it("is the only ability that fixes HP at 1", () => {
    expect(hasHpIsOne(["Wonder Guard"])).toBe(true);
    expect(hasHpIsOne(["Huge Power", "Wonder Guard"])).toBe(true);
    expect(hasHpIsOne(["Huge Power", "Hustle"])).toBe(false);
  });

  it("makes the stored HP 1 even with Macho Brace, vitamins and a high level, and leaves other stats alone", () => {
    expect(statAtLevel(0, 100, 50, 31, 1, { hpIsOne: true, machoBrace: 50, vitamin: 31 })).toBe(1);
    expect(statAtLevel(0, 100, 100, 31, 1, { hpIsOne: true })).toBe(1);
    expect(statAtLevel(1, 100, 50, 31, 1, { hpIsOne: true })).toBe(statAtLevel(1, 100, 50, 31, 1));
    expect(statAtLevel(0, 100, 50, 31, 1, { hpIsOne: false })).toBe(statAtLevel(0, 100, 50, 31, 1));
  });
});

describe("in-battle multiplier with abilities", () => {
  const a = mon("A"), b = mon("B");
  it("is part of the battle multiplier next to Eviolite and species items", () => {
    const items = { eviolite: false, species: [], abilities: ["Huge Power"] };
    expect(battleMultiplier(1, a, b, items)).toBe(2);
    expect(battleMultiplier(2, a, b, items)).toBe(1);
  });

  it("multiplies with a species item on the same stat", () => {
    const marowak = mon("Alolan Marowak");
    expect(battleMultiplier(1, marowak, b, { eviolite: false, species: ["thick-club"], abilities: ["Hustle"] })).toBe(3);
  });

  it("is unchanged when no abilities are given", () => {
    expect(battleMultiplier(1, a, b, { eviolite: false, species: [] })).toBe(1);
  });
});
