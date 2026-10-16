import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Pokemon } from "../src/types.js";

const TYPES = new Set([
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
  "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
]);

const dex = JSON.parse(readFileSync(new URL("../data/pokemon.json", import.meta.url), "utf8")) as Pokemon[];

describe("data/pokemon.json", () => {
  it("has a full dex", () => {
    expect(dex.length).toBeGreaterThanOrEqual(1000);
  });

  it("has unique names", () => {
    expect(new Set(dex.map(p => p.name)).size).toBe(dex.length);
  });

  it("has six whole, non-negative stats for every entry", () => {
    for (const p of dex) {
      expect(p.stats, p.name).toHaveLength(6);
      for (const s of p.stats) expect(Number.isInteger(s) && s >= 0, `${p.name} stat ${s}`).toBe(true);
    }
  });

  it("has one or two valid, different types for every entry", () => {
    for (const p of dex) {
      expect(p.types.length, p.name).toBeGreaterThanOrEqual(1);
      expect(p.types.length, p.name).toBeLessThanOrEqual(2);
      for (const t of p.types) expect(TYPES.has(t), `${p.name}: ${t}`).toBe(true);
      expect(new Set(p.types).size, p.name).toBe(p.types.length);
    }
  });

  // Only the format is checked here, not specific abilities: passives are game-balance
  // choices that PokeRogue changes over time, so pinning them would fail after a legitimate update.
  it("has a passive ability for every entry", () => {
    for (const p of dex) {
      expect(typeof p.passive, p.name).toBe("string");
      expect(p.passive.trim(), p.name).not.toBe("");
    }
  });

  it("uses a wide variety of passives", () => {
    expect(new Set(dex.map(p => p.passive)).size).toBeGreaterThan(100);
  });

  // Format only, for the same reason as the passives above.
  it("has one or two distinct regular abilities for every entry", () => {
    for (const p of dex) {
      const { regular } = p.abilities;
      expect(Array.isArray(regular), p.name).toBe(true);
      expect(regular.length, p.name).toBeGreaterThanOrEqual(1);
      expect(regular.length, p.name).toBeLessThanOrEqual(2);
      for (const a of regular) expect(typeof a === "string" && a.trim() !== "", `${p.name}: "${a}"`).toBe(true);
      expect(new Set(regular).size, p.name).toBe(regular.length);
    }
  });

  it("has a hidden ability that is either a name or null", () => {
    for (const p of dex) {
      const { hidden } = p.abilities;
      expect(hidden === null || (typeof hidden === "string" && hidden.trim() !== ""), `${p.name}: ${hidden}`).toBe(true);
    }
  });

  it("uses official-looking ability names, not raw IDs", () => {
    const names = dex.flatMap(p => [...p.abilities.regular, p.abilities.hidden ?? p.passive, p.passive]);
    for (const n of names) expect(/^[A-Z]+(_[A-Z]+)+$/.test(n), n).toBe(false);
    expect(new Set(names).size).toBeGreaterThan(150);
  });

  it("has the right numbers for well-known Pokémon", () => {
    const find = (name: string) => dex.find(p => p.name === name);
    expect(find("Garchomp")).toMatchObject({ stats: [108, 130, 95, 80, 85, 102], types: ["Dragon", "Ground"] });
    expect(find("Charizard")).toMatchObject({ stats: [78, 84, 78, 109, 85, 100], types: ["Fire", "Flying"] });
    expect(find("Blissey")?.stats[0]).toBe(255);
  });
});
