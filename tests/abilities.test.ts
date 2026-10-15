import { describe, expect, it } from "vitest";
import { abilityChoices } from "../src/abilities.js";
import type { Pokemon } from "../src/types.js";

const mon = (regular: string[], hidden: string | null): Pokemon => ({
  name: "Test",
  stats: [50, 50, 50, 50, 50, 50],
  types: ["Normal"],
  passive: "Passive",
  abilities: { regular, hidden },
});

describe("abilityChoices", () => {
  it("lists both regular abilities, then the hidden one marked as hidden", () => {
    expect(abilityChoices(mon(["Soundproof", "Filter"], "Technician"))).toEqual([
      { name: "Soundproof", hidden: false, label: "Soundproof" },
      { name: "Filter", hidden: false, label: "Filter" },
      { name: "Technician", hidden: true, label: "Technician (Hidden)" },
    ]);
  });

  it("has no hidden choice when the Pokémon has no hidden ability", () => {
    const choices = abilityChoices(mon(["Wonder Guard"], null));
    expect(choices.map(c => c.label)).toEqual(["Wonder Guard"]);
  });

  it("leaves out a hidden ability that only repeats a regular one", () => {
    expect(abilityChoices(mon(["Tough Claws"], "Tough Claws")).map(c => c.label)).toEqual(["Tough Claws"]);
    expect(abilityChoices(mon(["Soundproof", "Filter"], "Filter")).map(c => c.label)).toEqual(["Soundproof", "Filter"]);
  });

  it("always offers at least one choice for every Pokémon in the data", async () => {
    const { readFileSync } = await import("node:fs");
    const dex = JSON.parse(readFileSync(new URL("../data/pokemon.json", import.meta.url), "utf8")) as Pokemon[];
    for (const p of dex) expect(abilityChoices(p).length, p.name).toBeGreaterThanOrEqual(1);
  });
});
