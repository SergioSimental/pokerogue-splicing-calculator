import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { adjustedBaseStats, clampIv, clampLevel, fuse, MACHO_BRACE_MAX, MAX_LEVEL, SOUL_DEW_MAX, statAtLevel } from "../src/fuse.js";
import type { Stats } from "../src/types.js";
import type { Pokemon } from "../src/types.js";

const mon = (name: string, types: Pokemon["types"], stats: Pokemon["stats"] = [50, 50, 50, 50, 50, 50]): Pokemon => ({ name, types, stats, passive: "Test Ability", abilities: { regular: ["Test Ability"], hidden: null }, fusionName: "Test", canEvolve: false, isMax: false });

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

  it("applies the nature multiplier to non-HP stats", () => {
    expect(statAtLevel(1, 130, 50, 31, 1.1)).toBe(165);
    expect(statAtLevel(1, 130, 50, 31, 0.9)).toBe(135);
  });

  // The game rounds a boosting nature up and a hindering one down (never below 1).
  it("rounds a boosting nature up and a hindering nature down, like the game", () => {
    expect(statAtLevel(1, 100, 100, 31, 1)).toBe(236);
    expect(statAtLevel(1, 100, 100, 31, 1.1)).toBe(260); // 236 * 1.1 = 259.6, rounded up
    expect(statAtLevel(1, 100, 100, 31, 0.9)).toBe(212); // 236 * 0.9 = 212.4, rounded down
    expect(statAtLevel(5, 1, 1, 0, 0.9)).toBe(4); // 5 * 0.9 = 4.5, rounded down
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

describe("statAtLevel with held items", () => {
  const plain = 236; // Atk, base 100, level 100, 31 IVs, neutral nature (see the golden values below)

  it("changes nothing when no items are held", () => {
    expect(statAtLevel(1, 100, 100, 31, 1, {})).toBe(plain);
    expect(statAtLevel(1, 100, 100, 31, 1, { vitamin: 0, machoBrace: 0, soulDew: 0 })).toBe(plain);
  });

  describe("vitamins", () => {
    it("raise the base stat by 10% per stack, rounded down, before the level formula", () => {
      expect(statAtLevel(1, 100, 100, 31, 1, { vitamin: 10 })).toBe(436); // base 200
      expect(statAtLevel(1, 45, 50, 31, 1, { vitamin: 3 })).toBe(78); // base floor(45 * 1.3) = 58
    });

    // How many a Pokémon may hold (its IV for the stat) is checked where items are held, because the game's own
    // stat formula counts whatever stack it finds, and a fusion can leave more than the IV (see mergeStacks).
    it("count every stack they are given, up to 31", () => {
      expect(statAtLevel(1, 70, 50, 5, 1, { vitamin: 5 })).toBe(112);
      expect(statAtLevel(1, 70, 50, 5, 1, { vitamin: 31 })).toBe(294);
      expect(statAtLevel(1, 70, 50, 5, 1, { vitamin: 0 })).toBe(77);
      expect(statAtLevel(1, 70, 50, 5, 1, { vitamin: 99 })).toBe(294);
    });

    it("work on HP too", () => {
      expect(statAtLevel(0, 75, 50, 31, 1, { vitamin: 31 })).toBe(382);
    });
  });

  describe("Soul Dew", () => {
    it("widens a boosting nature by 0.1 per stack", () => {
      expect(statAtLevel(1, 100, 100, 31, 1.1, { soulDew: 5 })).toBe(378); // x1.6
      expect(statAtLevel(1, 100, 100, 31, 1.1, { soulDew: SOUL_DEW_MAX })).toBe(496); // x2.1
    });

    it("widens a hindering nature by 0.1 per stack, down to a minimum of 1", () => {
      expect(statAtLevel(1, 100, 100, 31, 0.9, { soulDew: 5 })).toBe(94); // x0.4
      expect(statAtLevel(1, 100, 100, 31, 0.9, { soulDew: 9 })).toBe(1);
      expect(statAtLevel(1, 100, 100, 31, 0.9, { soulDew: SOUL_DEW_MAX })).toBe(1);
    });

    it("does nothing for a stat the nature does not touch, or for HP", () => {
      expect(statAtLevel(1, 100, 100, 31, 1, { soulDew: SOUL_DEW_MAX })).toBe(plain);
      expect(statAtLevel(0, 100, 100, 31, 1, { soulDew: SOUL_DEW_MAX })).toBe(341);
    });
  });

  describe("Macho Brace", () => {
    it("adds 2 HP and 1 of each other stat per stack", () => {
      expect(statAtLevel(0, 100, 100, 31, 1)).toBe(341);
      expect(statAtLevel(0, 100, 100, 31, 1, { machoBrace: 25 })).toBe(391);
      expect(statAtLevel(1, 100, 100, 31, 1, { machoBrace: 7 })).toBe(243);
    });

    it("adds 10% HP and 5% of the others once it reaches 50 stacks", () => {
      expect(statAtLevel(0, 100, 100, 31, 1, { machoBrace: MACHO_BRACE_MAX })).toBe(485); // floor(441 * 1.1)
      expect(statAtLevel(1, 100, 100, 31, 1, { machoBrace: MACHO_BRACE_MAX })).toBe(300); // floor(286 * 1.05)
    });

    it("has no bonus at 49 stacks", () => {
      expect(statAtLevel(1, 100, 100, 31, 1, { machoBrace: MACHO_BRACE_MAX - 1 })).toBe(plain + 49);
    });
  });

  it("combines them in the game's order: vitamins, then nature and Soul Dew, then Macho Brace", () => {
    expect(statAtLevel(1, 100, 100, 31, 1.1, { vitamin: 10, machoBrace: 50, soulDew: 10 })).toBe(1014);
    expect(statAtLevel(0, 100, 100, 31, 1, { vitamin: 10, machoBrace: 50 })).toBe(705);
  });

  it("keeps stack counts inside the game's limits", () => {
    expect(statAtLevel(1, 100, 100, 31, 1, { machoBrace: 999 })).toBe(300);
    expect(statAtLevel(1, 100, 100, 31, 1, { machoBrace: -5, soulDew: -5, vitamin: -5 })).toBe(plain);
    expect(statAtLevel(1, 100, 100, 31, 1.1, { soulDew: 999 })).toBe(496);
    expect(statAtLevel(1, 100, 100, 31, 1, { machoBrace: Number.NaN, vitamin: Number.NaN })).toBe(plain);
  });

  // 600 stats worked out by tests/fixtures/make-stat-cases.py, an independent port of the game's formula.
  it("matches an independent port of PokeRogue's formula on 600 mixed cases", () => {
    const cases = JSON.parse(readFileSync(new URL("./fixtures/stat-cases.json", import.meta.url), "utf8")) as number[][];
    expect(cases).toHaveLength(600);
    for (const [stat, base, level, iv, nature, vitamin, machoBrace, soulDew, expected] of cases) {
      const label = JSON.stringify({ stat, base, level, iv, nature, vitamin, machoBrace, soulDew });
      expect(statAtLevel(stat ?? 0, base ?? 0, level ?? 1, iv ?? 0, nature, { vitamin, machoBrace, soulDew }), label).toBe(expected);
    }
  });
});

// Sweet and Foul Shuckle Juice and Old Gateau change the primary Pokémon's own base stats (PokeRogue's
// Pokemon.calculateBaseStats), before they are averaged with the secondary's.
describe("adjustedBaseStats", () => {
  const charizard: Stats = [78, 84, 78, 109, 85, 100];

  it("changes nothing without items, and returns a copy", () => {
    const same = adjustedBaseStats(charizard);
    expect(same).toEqual(charizard);
    expect(same).not.toBe(charizard);
    expect(adjustedBaseStats(charizard, {})).toEqual(charizard);
    expect(adjustedBaseStats(charizard, { sweetJuice: false, foulJuice: false, oldGateau: false })).toEqual(charizard);
  });

  it("Sweet Shuckle Juice adds 10 to every stat and 5 to HP", () => {
    expect(adjustedBaseStats(charizard, { sweetJuice: true })).toEqual([83, 94, 88, 119, 95, 110]);
  });

  it("Foul Shuckle Juice takes 15 off every stat and 7.5 off HP, rounded down", () => {
    expect(adjustedBaseStats(charizard, { foulJuice: true })).toEqual([70, 69, 63, 94, 70, 85]); // HP: floor(70.5)
  });

  it("holding both applies the sweet one and then the foul one", () => {
    expect(adjustedBaseStats(charizard, { sweetJuice: true, foulJuice: true })).toEqual([75, 79, 73, 104, 80, 95]);
  });

  it("Old Gateau adds 20 to the lower of HP/Spe, Atk/SpA and Def/SpD", () => {
    expect(adjustedBaseStats(charizard, { oldGateau: true })).toEqual([98, 104, 98, 109, 85, 100]);
    expect(adjustedBaseStats([100, 120, 90, 60, 80, 40], { oldGateau: true })).toEqual([100, 120, 90, 80, 100, 60]);
  });

  it("Old Gateau gives a tie to Speed, Sp. Atk and Sp. Def", () => {
    expect(adjustedBaseStats([50, 50, 50, 50, 50, 50], { oldGateau: true })).toEqual([50, 50, 50, 70, 70, 70]);
  });

  it("Old Gateau chooses its stats from the original base stats, before any Shuckle Juice", () => {
    // HP 50 is lower than Spe 54; Foul Juice then leaves HP at 42, which is above Spe's 39, but the pick was already HP.
    expect(adjustedBaseStats([50, 60, 60, 60, 60, 54], { foulJuice: true, oldGateau: true })).toEqual([62, 45, 45, 65, 65, 39]);
  });

  it("keeps every changed stat between 1 and 999,999", () => {
    expect(adjustedBaseStats([1, 5, 10, 14, 15, 16], { foulJuice: true })).toEqual([1, 1, 1, 1, 1, 1]);
    expect(adjustedBaseStats([999999, 999999, 999999, 999999, 999999, 999999], { sweetJuice: true, oldGateau: true }))
      .toEqual([999999, 999999, 999999, 999999, 999999, 999999]);
    expect(adjustedBaseStats([999990, 5, 5, 5, 5, 5], { sweetJuice: true })).toEqual([999995, 15, 15, 15, 15, 15]);
  });

  // 600 cases from tests/fixtures/make-stat-cases.py (run with "base"), an independent port of the game's code.
  it("matches an independent port of PokeRogue's code on 600 mixed cases", () => {
    const rows = JSON.parse(readFileSync(new URL("./fixtures/base-stat-cases.json", import.meta.url), "utf8")) as [
      Stats, boolean, boolean, boolean, Stats,
    ][];
    expect(rows).toHaveLength(600);
    for (const [base, sweetJuice, foulJuice, oldGateau, expected] of rows) {
      const label = JSON.stringify({ base, sweetJuice, foulJuice, oldGateau });
      expect(adjustedBaseStats(base, { sweetJuice, foulJuice, oldGateau }), label).toEqual(expected);
    }
  });
});

describe("fuse with base-stat items", () => {
  const a = mon("A", ["Fire"], [100, 90, 80, 70, 60, 50]);
  const b = mon("B", ["Water"], [50, 50, 50, 50, 50, 50]);

  it("averages the primary's adjusted stats with the secondary's untouched ones, rounding up", () => {
    expect(fuse(a, b).stats).toEqual([75, 70, 65, 60, 55, 50]);
    expect(fuse(a, b, { sweetJuice: true }).stats).toEqual([78, 75, 70, 65, 60, 55]);
    expect(fuse(a, b, { foulJuice: true }).stats).toEqual([71, 63, 58, 53, 48, 43]);
    expect(fuse(a, b, { oldGateau: true }).stats).toEqual([75, 70, 65, 70, 65, 60]);
  });

  it("only ever changes the primary's side: Old Gateau follows the primary's own stats", () => {
    const c = mon("C", ["Grass"], [40, 50, 50, 60, 60, 80]);
    expect(fuse(c, b, { oldGateau: true }).stats).toEqual([55, 60, 60, 55, 55, 65]);
    expect(fuse(b, c, { oldGateau: true }).stats).toEqual([45, 50, 50, 65, 65, 75]);
  });

  it("leaves the types alone and does not change the Pokémon it was given", () => {
    const before = [...a.stats];
    expect(fuse(a, b, { sweetJuice: true, oldGateau: true }).types).toEqual(fuse(a, b).types);
    expect(a.stats).toEqual(before);
  });
});
