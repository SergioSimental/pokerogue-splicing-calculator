import { describe, expect, it } from "vitest";
import { clampIv, clampLevel, fuse, MAX_LEVEL, statAtLevel } from "../src/fuse.js";
import type { Pokemon } from "../src/types.js";

const mon = (name: string, types: Pokemon["types"], stats: Pokemon["stats"] = [50, 50, 50, 50, 50, 50]): Pokemon => ({ name, types, stats });

describe("fuse: stats", () => {
  it("averages each stat", () => {
    const a = mon("A", ["Fire"], [100, 80, 60, 40, 20, 10]);
    const b = mon("B", ["Water"], [50, 40, 30, 20, 10, 0]);
    expect(fuse(a, b).stats).toEqual([75, 60, 45, 30, 15, 5]);
  });

  it("rounds odd sums up", () => {
    const a = mon("A", ["Fire"], [45, 49, 49, 65, 65, 45]);
    const b = mon("B", ["Water"], [46, 50, 50, 66, 66, 46]);
    expect(fuse(a, b).stats).toEqual([46, 50, 50, 66, 66, 46]); // 45.5 -> 46, 49.5 -> 50, ...
  });

  it("does not depend on which Pokémon is primary (stats only)", () => {
    const a = mon("A", ["Fire"], [10, 20, 30, 40, 50, 60]);
    const b = mon("B", ["Water"], [11, 22, 33, 44, 55, 66]);
    expect(fuse(a, b).stats).toEqual(fuse(b, a).stats);
  });
});

describe("fuse: types", () => {
  it("takes the primary type from the primary Pokémon and the secondary type from the secondary Pokémon", () => {
    const charizard = mon("Charizard", ["Fire", "Flying"]);
    const garchomp = mon("Garchomp", ["Dragon", "Ground"]);
    expect(fuse(charizard, garchomp).types).toEqual(["Fire", "Ground"]);
  });

  it("uses the secondary Pokémon's only type when it has no second type", () => {
    const charizard = mon("Charizard", ["Fire", "Flying"]);
    const blastoise = mon("Blastoise", ["Water"]);
    expect(fuse(charizard, blastoise).types).toEqual(["Fire", "Water"]);
  });

  it("falls back to the primary Pokémon's second type when the types would repeat", () => {
    const oddish = mon("Oddish", ["Grass", "Poison"]);
    const tangela = mon("Tangela", ["Grass"]);
    expect(fuse(oddish, tangela).types).toEqual(["Grass", "Poison"]);
  });

  it("returns a single type when both Pokémon are the same single type", () => {
    expect(fuse(mon("A", ["Water"]), mon("B", ["Water"])).types).toEqual(["Water"]);
  });

  it("never repeats a type", () => {
    const a = mon("A", ["Fire", "Flying"]);
    const b = mon("B", ["Normal", "Fire"]);
    const types = fuse(a, b).types;
    expect(new Set(types).size).toBe(types.length);
  });
});

describe("clampLevel", () => {
  it.each([
    [0, 1], [-5, 1], [1, 1], [50.9, 50], [69222, 69222], [500000, 500000],
    [Number.NaN, 1], [Number.POSITIVE_INFINITY, 1], [1e15, MAX_LEVEL],
  ])("clampLevel(%s) = %s", (input, expected) => {
    expect(clampLevel(input)).toBe(expected);
  });
});

describe("clampIv", () => {
  it.each([[-3, 0], [0, 0], [15.7, 15], [31, 31], [40, 31], [Number.NaN, 0]])("clampIv(%s) = %s", (input, expected) => {
    expect(clampIv(input)).toBe(expected);
  });
});

describe("statAtLevel", () => {
  it("matches known in-game values at level 100 with 31 IVs and a neutral nature", () => {
    expect(statAtLevel(0, 108, 100, 31)).toBe(357); // Garchomp HP
    expect(statAtLevel(1, 130, 100, 31)).toBe(296); // Garchomp Atk
  });

  it("uses the HP formula for stat 0 and the other formula for the rest", () => {
    expect(statAtLevel(0, 108, 50, 31)).toBe(183);
    expect(statAtLevel(1, 130, 50, 31)).toBe(150);
  });

  it("handles level 1 and zero IVs", () => {
    expect(statAtLevel(0, 1, 1, 0)).toBe(11);
    expect(statAtLevel(1, 1, 1, 0)).toBe(5);
  });

  it("applies the nature multiplier to non-HP stats and rounds down", () => {
    expect(statAtLevel(1, 130, 50, 31, 1.1)).toBe(165);
    expect(statAtLevel(1, 130, 50, 31, 0.9)).toBe(135);
  });

  it("never applies a nature multiplier to HP", () => {
    expect(statAtLevel(0, 108, 50, 31, 1.1)).toBe(183);
    expect(statAtLevel(0, 108, 50, 31, 0.9)).toBe(183);
  });

  it("scales to very high levels without losing precision", () => {
    expect(statAtLevel(1, 130, 500000, 31)).toBe(1455005);
  });

  it("gives higher IVs a higher or equal stat", () => {
    for (let iv = 0; iv < 31; iv++) {
      expect(statAtLevel(3, 100, 77, iv + 1)).toBeGreaterThanOrEqual(statAtLevel(3, 100, 77, iv));
    }
  });
});
