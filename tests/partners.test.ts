import { describe, expect, it } from "vitest";
import { fuse, statAtLevel } from "../src/fuse.js";
import { rankPartners, type PartnerOptions } from "../src/partners.js";
import type { Pokemon } from "../src/types.js";

type Flags = Partial<Pick<Pokemon, "isMax" | "isMega" | "isSpecial">>;
const mon = (name: string, types: Pokemon["types"], stats: Pokemon["stats"], flags: Flags = {}): Pokemon => ({
  name, types, stats, passive: "P", abilities: { regular: ["A"], hidden: null }, fusionName: name, canEvolve: false,
  isMax: false, isMega: false, isSpecial: false, ...flags,
});

const primary = mon("Prime", ["Fire"], [100, 100, 100, 100, 100, 100]);
const tank = mon("Tank", ["Steel", "Rock"], [200, 50, 200, 50, 200, 20]);
const sprinter = mon("Sprinter", ["Electric"], [40, 60, 40, 60, 40, 200]);
const giant = mon("Giant", ["Dragon"], [250, 250, 250, 250, 250, 250], { isMax: true });
const dex = [primary, tank, sprinter, giant];

const base: PartnerOptions = {
  level: 50, ivs: [31, 31, 31, 31, 31, 31], natureMultiplier: () => 1, rankBy: "total", heldFor: () => ({}), limit: 10,
};
const names = (o: Partial<PartnerOptions> = {}) => rankPartners(primary, dex, { ...base, ...o }).map(p => p.secondary.name);

describe("rankPartners", () => {
  it("ranks by total, highest first", () => {
    expect(names()).toEqual(["Giant", "Tank", "Prime", "Sprinter"]);
  });

  it("ranks by a single stat", () => {
    expect(names({ rankBy: 5 })[0]).toBe("Giant");
    expect(names({ rankBy: 5, hideMax: true })).toEqual(["Sprinter", "Prime", "Tank"]);
    expect(names({ rankBy: 2, hideMax: true })).toEqual(["Tank", "Prime", "Sprinter"]);
  });

  it("matches fuse and statAtLevel for every partner", () => {
    for (const p of rankPartners(primary, dex, base)) {
      const f = fuse(primary, p.secondary);
      const expected = f.stats.map((v, i) => statAtLevel(i, v, 50, 31, 1, {}));
      expect(p.stats).toEqual(expected);
      expect(p.types).toEqual(f.types);
      expect(p.total).toBe(expected.reduce((a, b) => a + b, 0));
    }
  });

  it("keeps only fused Pokémon that have the chosen type", () => {
    expect(names({ type: "Rock" })).toEqual(["Tank"]);
    // Fire + Fire is a single type, and the primary type is always kept
    expect(names({ type: "Fire" })).toEqual(["Giant", "Tank", "Prime", "Sprinter"]);
    expect(names({ type: "Water" })).toEqual([]);
  });

  it("can hide Max forms", () => {
    expect(names({ hideMax: true })).not.toContain("Giant");
  });

  it("stops at the limit", () => {
    expect(names({ limit: 2 })).toEqual(["Giant", "Tank"]);
  });

  it("uses the level, IVs, nature and held items", () => {
    const lowIv = rankPartners(primary, dex, { ...base, ivs: [0, 0, 0, 0, 0, 0] })[0]?.stats;
    const highIv = rankPartners(primary, dex, base)[0]?.stats;
    expect(lowIv?.every((v, i) => v < (highIv?.[i] ?? 0))).toBe(true);

    const hasty = rankPartners(primary, dex, { ...base, natureMultiplier: i => (i === 5 ? 1.1 : 1) })[0]?.stats[5];
    const neutral = highIv?.[5];
    expect(hasty).toBeGreaterThan(neutral ?? 0);

    const braced = rankPartners(primary, dex, { ...base, heldFor: () => ({ machoBrace: 50 }) })[0]?.stats;
    expect(braced?.every((v, i) => v > (highIv?.[i] ?? 0))).toBe(true);
  });

  it("applies Old Gateau and the juices to the primary before fusing", () => {
    const plain = rankPartners(primary, dex, base).find(p => p.secondary === tank)?.stats;
    const sweet = rankPartners(primary, dex, { ...base, baseItems: { sweetJuice: true } }).find(p => p.secondary === tank)?.stats;
    expect(sweet?.[0]).toBeGreaterThan(plain?.[0] ?? 0);
  });

  it("breaks ties by total, then by name", () => {
    const a = mon("Alpha", ["Water"], [100, 100, 100, 100, 100, 100]);
    const b = mon("Beta", ["Water"], [100, 100, 100, 100, 100, 100]);
    expect(rankPartners(primary, [b, a], base).map(p => p.secondary.name)).toEqual(["Alpha", "Beta"]);
    const hi = mon("Hi", ["Water"], [100, 100, 100, 100, 100, 100]);
    const wide = mon("A-wide", ["Water"], [100, 100, 100, 100, 100, 100]);
    const spread = mon("Spread", ["Water"], [10, 10, 10, 10, 10, 100]);
    // equal Speed; the higher total comes first
    expect(rankPartners(primary, [spread, hi, wide], { ...base, rankBy: 5 }).map(p => p.secondary.name)).toEqual(["A-wide", "Hi", "Spread"]);
  });

  it("does not change the dex it is given", () => {
    const before = JSON.stringify(dex);
    names();
    expect(JSON.stringify(dex)).toBe(before);
  });
});

describe("hiding Mega forms", () => {
  it("hides flagged entries, independently of Max forms", () => {
    const mega = mon("Zed (Mega)", ["Dragon"], [250, 250, 250, 250, 250, 250], { isMega: true });
    const all = [primary, tank, giant, mega];
    const list = (o: Partial<PartnerOptions>) => rankPartners(primary, all, { ...base, ...o }).map(p => p.secondary.name);
    expect(list({})).toContain("Zed (Mega)");
    expect(list({ hideMega: true })).not.toContain("Zed (Mega)");
    expect(list({ hideMega: true })).toContain("Giant");
    expect(list({ hideMax: true })).toContain("Zed (Mega)");
    expect(list({ hideMax: true })).not.toContain("Giant");
  });

  it("goes by the flag, not the name", () => {
    const decoy = mon("Mega Decoy (Mega)", ["Dragon"], [250, 250, 250, 250, 250, 250]);
    const real = mon("Zed", ["Dragon"], [250, 250, 250, 250, 250, 250], { isMega: true });
    const list = rankPartners(primary, [primary, decoy, real], { ...base, hideMega: true }).map(p => p.secondary.name);
    expect(list).toContain("Mega Decoy (Mega)");
    expect(list).not.toContain("Zed");
  });
});

describe("hiding special forms", () => {
  it("hides flagged entries, independently of the other two filters", () => {
    const strong = [250, 250, 250, 250, 250, 250] as const;
    const primal = mon("Zed (Primal)", ["Fire"], [...strong], { isSpecial: true });
    const mega = mon("Zed (Mega)", ["Fire"], [...strong], { isMega: true });
    const max = mon("Zed (G-Max)", ["Fire"], [...strong], { isMax: true });
    const regional = mon("Alolan Zed", ["Fire"], [...strong]);
    const all = [primary, primal, mega, max, regional];
    const list = (o: Partial<PartnerOptions>) => rankPartners(primary, all, { ...base, ...o }).map(p => p.secondary.name).sort();
    expect(list({})).toEqual(["Alolan Zed", "Prime", "Zed (G-Max)", "Zed (Mega)", "Zed (Primal)"]);
    expect(list({ hideSpecial: true })).toEqual(["Alolan Zed", "Prime", "Zed (G-Max)", "Zed (Mega)"]);
    expect(list({ hideMega: true })).toContain("Zed (Primal)");
    expect(list({ hideMax: true })).toContain("Zed (Primal)");
    expect(list({ hideMax: true, hideMega: true, hideSpecial: true })).toEqual(["Alolan Zed", "Prime"]);
  });
});

describe("filtering by ability", () => {
  const withAbilities = (name: string, regular: string[], hidden: string | null, stats = 50) =>
    ({ ...mon(name, ["Normal"], [stats, stats, stats, stats, stats, stats]), abilities: { regular, hidden } });
  const prime = mon("Prime", ["Fire"], [100, 100, 100, 100, 100, 100]);
  const pool = [
    withAbilities("Brute", ["Huge Power", "Pure Power"], "Wonder Guard", 60),
    withAbilities("Echo", ["Huge Power"], null, 90),
    withAbilities("Sly", ["Blaze"], "Huge Power", 70),
    withAbilities("Plain", ["Blaze"], "Blaze", 80),
  ];
  const list = (o: Partial<PartnerOptions> = {}) => rankPartners(prime, pool, { ...base, ...o }).map(p => p.secondary.name);

  it("keeps only the partners that can have the ability, regular or hidden", () => {
    expect(list({ ability: "Huge Power" })).toEqual(["Echo", "Sly", "Brute"]);
    expect(list({ ability: "Wonder Guard" })).toEqual(["Brute"]);
    expect(list({ ability: "Pure Power" })).toEqual(["Brute"]);
    expect(list({ ability: "Nonexistent" })).toEqual([]);
  });

  it("keeps everyone when no ability is asked for, including an empty one", () => {
    expect(list()).toHaveLength(4);
    expect(list({ ability: "" })).toHaveLength(4);
  });

  it("ranks the matching partners as usual and works with the other filters", () => {
    expect(list({ ability: "Huge Power", rankBy: 0 })).toEqual(["Echo", "Sly", "Brute"]);
    expect(list({ ability: "Huge Power", type: "Fire" })).toEqual(["Echo", "Sly", "Brute"]);
    expect(list({ ability: "Huge Power", type: "Water" })).toEqual([]);
    expect(list({ ability: "Huge Power", limit: 1 })).toEqual(["Echo"]);
  });

  it("lists each partner's abilities with the hidden one last, and leaves out a repeated hidden ability", () => {
    const abilities = (name: string) => rankPartners(prime, pool, base).find(p => p.secondary.name === name)?.abilities.map(a => a.label);
    expect(abilities("Brute")).toEqual(["Huge Power", "Pure Power", "Wonder Guard (Hidden)"]);
    expect(abilities("Plain")).toEqual(["Blaze"]);
    expect(abilities("Sly")).toEqual(["Blaze", "Huge Power (Hidden)"]);
  });

  it("does not match a name that only contains the ability's name", () => {
    const extra = [...pool, withAbilities("Near", ["Huge Power Plus"], null, 99)];
    expect(rankPartners(prime, extra, { ...base, ability: "Huge Power" }).map(p => p.secondary.name)).not.toContain("Near");
  });
});
