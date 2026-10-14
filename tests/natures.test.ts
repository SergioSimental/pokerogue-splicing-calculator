import { describe, expect, it } from "vitest";
import { NATURES, natureLabel, natureMultiplier } from "../src/natures.js";
import { STAT_NAMES } from "../src/types.js";

const nature = (name: string) => {
  const found = NATURES.find(n => n.name === name);
  if (!found) throw new Error(`No nature named ${name}`);
  return found;
};

describe("NATURES", () => {
  it("has the 25 natures in PokeRogue's order", () => {
    expect(NATURES).toHaveLength(25);
    expect(NATURES[0]?.name).toBe("Hardy");
    expect(NATURES[24]?.name).toBe("Quirky");
  });

  it("has unique names", () => {
    expect(new Set(NATURES.map(n => n.name)).size).toBe(25);
  });

  it("has exactly five neutral natures", () => {
    const neutral = NATURES.filter(n => n.up === undefined && n.down === undefined).map(n => n.name);
    expect(neutral.sort()).toEqual(["Bashful", "Docile", "Hardy", "Quirky", "Serious"]);
  });

  it("never touches HP and always raises and lowers different stats", () => {
    for (const n of NATURES.filter(x => x.up !== undefined)) {
      expect(n.up).toBeGreaterThanOrEqual(1);
      expect(n.up).toBeLessThanOrEqual(5);
      expect(n.down).toBeGreaterThanOrEqual(1);
      expect(n.down).toBeLessThanOrEqual(5);
      expect(n.up).not.toBe(n.down);
    }
  });

  it("raises and lowers each of the five stats exactly four times, as in the real game", () => {
    for (let stat = 1; stat <= 5; stat++) {
      expect(NATURES.filter(n => n.up === stat)).toHaveLength(4);
      expect(NATURES.filter(n => n.down === stat)).toHaveLength(4);
    }
  });

  it("has no two natures with the same raise/lower pair", () => {
    const pairs = NATURES.filter(n => n.up !== undefined).map(n => `${n.up}-${n.down}`);
    expect(new Set(pairs).size).toBe(20);
  });

  it.each([
    ["Adamant", "Atk", "SpA"],
    ["Timid", "Spe", "Atk"],
    ["Modest", "SpA", "Atk"],
    ["Bold", "Def", "Atk"],
    ["Calm", "SpD", "Atk"],
  ])("%s raises %s and lowers %s", (name, up, down) => {
    const n = nature(name);
    expect(STAT_NAMES[n.up ?? -1]).toBe(up);
    expect(STAT_NAMES[n.down ?? -1]).toBe(down);
  });
});

describe("natureMultiplier", () => {
  it("is 1.1 for the raised stat, 0.9 for the lowered stat and 1 for everything else", () => {
    const adamant = nature("Adamant"); // +Atk (1), -SpA (3)
    expect(natureMultiplier(adamant, 1)).toBe(1.1);
    expect(natureMultiplier(adamant, 3)).toBe(0.9);
    for (const other of [0, 2, 4, 5]) expect(natureMultiplier(adamant, other)).toBe(1);
  });

  it("is always 1 for neutral natures and when no nature is given", () => {
    for (let i = 0; i < 6; i++) {
      expect(natureMultiplier(nature("Hardy"), i)).toBe(1);
      expect(natureMultiplier(undefined, i)).toBe(1);
    }
  });

  it("never changes HP for any nature", () => {
    for (const n of NATURES) expect(natureMultiplier(n, 0)).toBe(1);
  });
});

describe("natureLabel", () => {
  it("shows the raised and lowered stats", () => {
    expect(natureLabel(nature("Adamant"))).toBe("Adamant (+Atk, -SpA)");
  });

  it("marks neutral natures", () => {
    expect(natureLabel(nature("Hardy"))).toBe("Hardy (neutral)");
  });
});
