import { describe, expect, it } from "vitest";
import { MAX_IV } from "../src/fuse.js";
import { clampCount, HELD_ITEM_LIMITS } from "../src/heldItems.js";

describe("HELD_ITEM_LIMITS", () => {
  it("matches PokeRogue's stack limits (Soul Dew 10, Macho Brace 50) and the highest possible IV for vitamins", () => {
    expect(HELD_ITEM_LIMITS.soulDew).toBe(10);
    expect(HELD_ITEM_LIMITS.machoBrace).toBe(50);
    expect(HELD_ITEM_LIMITS.vitamin).toBe(MAX_IV);
  });
});

describe("clampCount", () => {
  it("keeps whole numbers in range as they are", () => {
    expect(clampCount(0, 10)).toBe(0);
    expect(clampCount(7, 10)).toBe(7);
    expect(clampCount(10, 10)).toBe(10);
  });

  it("caps anything above the maximum", () => {
    expect(clampCount(11, 10)).toBe(10);
    expect(clampCount(1_000_000, 50)).toBe(50);
  });

  it("raises anything negative to 0", () => {
    expect(clampCount(-1, 10)).toBe(0);
    expect(clampCount(-0.5, 10)).toBe(0);
  });

  it("rounds fractions down", () => {
    expect(clampCount(7.9, 10)).toBe(7);
    expect(clampCount(9.999, 10)).toBe(9);
  });

  it("turns unreadable values into 0", () => {
    expect(clampCount(Number.NaN, 10)).toBe(0);
    expect(clampCount(Number.POSITIVE_INFINITY, 10)).toBe(0);
    expect(clampCount(Number("abc"), 10)).toBe(0);
    expect(clampCount(Number(""), 10)).toBe(0);
  });
});

// ---- species-specific items ----
import { readFileSync } from "node:fs";
import { matchesSpecies, SPECIES_ITEMS, speciesItemsFor } from "../src/heldItems.js";
import type { Pokemon } from "../src/types.js";

const mon = (name: string): Pokemon => ({
  name,
  stats: [50, 50, 50, 50, 50, 50],
  types: ["Normal"],
  passive: "Passive",
  abilities: { regular: ["Ability"], hidden: null },
  fusionName: name,
});
const idsFor = (a: string, b: string) => speciesItemsFor(mon(a), mon(b)).map(i => i.id);

describe("SPECIES_ITEMS", () => {
  // Taken from SpeciesStatBoosterModifierTypeGenerator.items in PokeRogue's modifier-type.ts.
  it("lists the six items and the species PokeRogue gives each", () => {
    expect(SPECIES_ITEMS.map(i => [i.name, ...i.species])).toEqual([
      ["Deep Sea Tooth", "Clamperl"],
      ["Deep Sea Scale", "Clamperl"],
      ["Light Ball", "Pikachu"],
      ["Thick Club", "Cubone", "Marowak", "Alolan Marowak"],
      ["Metal Powder", "Ditto"],
      ["Quick Powder", "Ditto"],
    ]);
  });

  it("has unique ids", () => {
    expect(new Set(SPECIES_ITEMS.map(i => i.id)).size).toBe(SPECIES_ITEMS.length);
  });

  it("only lists species that exist in the data, so a renamed entry cannot silently hide an item", () => {
    const dex = JSON.parse(readFileSync(new URL("../data/pokemon.json", import.meta.url), "utf8")) as Pokemon[];
    for (const item of SPECIES_ITEMS) {
      for (const label of item.species) {
        expect(dex.some(p => matchesSpecies(p.name, [label])), `${item.name}: ${label}`).toBe(true);
      }
    }
  });

  it("matches only entries that belong to those species in the real data", () => {
    const dex = JSON.parse(readFileSync(new URL("../data/pokemon.json", import.meta.url), "utf8")) as Pokemon[];
    for (const item of SPECIES_ITEMS) {
      for (const p of dex.filter(p => matchesSpecies(p.name, item.species))) {
        expect(item.species.some(label => p.name === label || p.name.startsWith(`${label} (`)), p.name).toBe(true);
      }
    }
    expect(dex.filter(p => matchesSpecies(p.name, ["Pikachu"])).every(p => p.name.startsWith("Pikachu"))).toBe(true);
  });
});

describe("matchesSpecies", () => {
  it("matches the species and its forms", () => {
    expect(matchesSpecies("Pikachu", ["Pikachu"])).toBe(true);
    expect(matchesSpecies("Pikachu (Cosplay)", ["Pikachu"])).toBe(true);
    expect(matchesSpecies("Pikachu (G-Max)", ["Pikachu"])).toBe(true);
  });

  it("does not match a different species that only contains the name", () => {
    expect(matchesSpecies("Raichu", ["Pikachu"])).toBe(false);
    expect(matchesSpecies("Alolan Raichu", ["Pikachu"])).toBe(false);
    expect(matchesSpecies("Dittox", ["Ditto"])).toBe(false);
  });

  it("keeps Marowak and Alolan Marowak separate unless both are listed", () => {
    expect(matchesSpecies("Alolan Marowak", ["Marowak"])).toBe(false);
    expect(matchesSpecies("Alolan Marowak", ["Cubone", "Marowak", "Alolan Marowak"])).toBe(true);
  });
});

describe("speciesItemsFor", () => {
  it("offers nothing for Pokémon none of the items work for", () => {
    expect(idsFor("Charizard", "Garchomp")).toEqual([]);
    expect(idsFor("Raichu", "Alolan Raichu")).toEqual([]);
  });

  it("offers the matching items for the primary Pokémon", () => {
    expect(idsFor("Pikachu", "Garchomp")).toEqual(["light-ball"]);
    expect(idsFor("Ditto", "Garchomp")).toEqual(["metal-powder", "quick-powder"]);
    expect(idsFor("Clamperl", "Garchomp")).toEqual(["deep-sea-tooth", "deep-sea-scale"]);
    expect(idsFor("Cubone", "Garchomp")).toEqual(["thick-club"]);
    expect(idsFor("Alolan Marowak", "Garchomp")).toEqual(["thick-club"]);
  });

  it("also offers them when only the secondary (fusion partner) matches, as the game does", () => {
    expect(idsFor("Garchomp", "Pikachu (Cosplay)")).toEqual(["light-ball"]);
    expect(idsFor("Garchomp", "Ditto")).toEqual(["metal-powder", "quick-powder"]);
  });

  it("combines items when both Pokémon unlock some, listed once each in table order", () => {
    expect(idsFor("Pikachu", "Ditto")).toEqual(["light-ball", "metal-powder", "quick-powder"]);
    expect(idsFor("Cubone", "Marowak")).toEqual(["thick-club"]);
    expect(idsFor("Ditto", "Clamperl")).toEqual(["deep-sea-tooth", "deep-sea-scale", "metal-powder", "quick-powder"]);
  });
});
