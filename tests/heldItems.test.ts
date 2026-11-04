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
import { battleMultiplier, battleStat, evioliteMultiplier, matchesSpecies, SPECIES_ITEMS, speciesItemsFor } from "../src/heldItems.js";
import type { Pokemon } from "../src/types.js";

const mon = (name: string, extra: Partial<Pokemon> = {}): Pokemon => ({
  name,
  stats: [50, 50, 50, 50, 50, 50],
  types: ["Normal"],
  passive: "Passive",
  abilities: { regular: ["Ability"], hidden: null },
  fusionName: name,
  canEvolve: false,
  isMax: false,
  ...extra,
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

describe("SPECIES_ITEMS stats", () => {
  // From SpeciesStatBoosterModifierTypeGenerator.items in PokeRogue's modifier-type.ts (stat indexes: 1 Atk, 2 Def, 3 SpA, 4 SpD, 5 Spe).
  it("doubles the stats PokeRogue lists for each item", () => {
    expect(SPECIES_ITEMS.map(i => [i.name, ...i.stats])).toEqual([
      ["Deep Sea Tooth", 3],
      ["Deep Sea Scale", 4],
      ["Light Ball", 1, 3],
      ["Thick Club", 1],
      ["Metal Powder", 2],
      ["Quick Powder", 5],
    ]);
  });
});

describe("evioliteMultiplier", () => {
  const evolves = mon("Evolves", { canEvolve: true });
  const done = mon("Done");

  it("gives the full 1.5 when both Pokémon can still evolve", () => {
    expect(evioliteMultiplier(evolves, mon("Other", { canEvolve: true }))).toBe(1.5);
  });

  it("gives half the boost (1.25) when only one can, whichever it is", () => {
    expect(evioliteMultiplier(evolves, done)).toBe(1.25);
    expect(evioliteMultiplier(done, evolves)).toBe(1.25);
  });

  it("gives nothing when neither can evolve", () => {
    expect(evioliteMultiplier(done, mon("Also done"))).toBe(1);
  });

  it("gives nothing when either Pokémon is a Gigantamax or Eternamax form, even if both can evolve", () => {
    const max = mon("Max", { canEvolve: true, isMax: true });
    expect(evioliteMultiplier(max, evolves)).toBe(1);
    expect(evioliteMultiplier(evolves, max)).toBe(1);
  });
});

describe("battleMultiplier", () => {
  const evolves = mon("Pikachu (Cosplay)", { canEvolve: true });
  const clamperl = mon("Clamperl", { canEvolve: true });
  const ditto = mon("Ditto");
  const none = { eviolite: false, species: [] };
  const all = (m: (stat: number) => number) => [0, 1, 2, 3, 4, 5].map(m);

  it("is 1 for every stat when nothing is ticked", () => {
    expect(all(i => battleMultiplier(i, evolves, clamperl, none))).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("applies Eviolite to Def and Sp. Def only", () => {
    expect(all(i => battleMultiplier(i, evolves, clamperl, { eviolite: true, species: [] }))).toEqual([1, 1, 1.5, 1, 1.5, 1]);
    expect(all(i => battleMultiplier(i, evolves, ditto, { eviolite: true, species: [] }))).toEqual([1, 1, 1.25, 1, 1.25, 1]);
  });

  it("doubles only the stats a ticked species item lists", () => {
    expect(all(i => battleMultiplier(i, evolves, ditto, { eviolite: false, species: ["light-ball"] }))).toEqual([1, 2, 1, 2, 1, 1]);
    expect(all(i => battleMultiplier(i, evolves, ditto, { eviolite: false, species: ["metal-powder"] }))).toEqual([1, 1, 2, 1, 1, 1]);
    expect(all(i => battleMultiplier(i, evolves, ditto, { eviolite: false, species: ["quick-powder"] }))).toEqual([1, 1, 1, 1, 1, 2]);
  });

  it("stacks items that boost the same stat", () => {
    // Light Ball and Deep Sea Tooth both double Sp. Atk; Deep Sea Scale and Eviolite both lift Sp. Def.
    const items = { eviolite: true, species: ["light-ball", "deep-sea-tooth", "deep-sea-scale"] };
    expect(all(i => battleMultiplier(i, evolves, clamperl, items))).toEqual([1, 2, 1.5, 4, 3, 1]);
  });

  it("ignores a ticked item that does not apply to the picked pair", () => {
    expect(all(i => battleMultiplier(i, ditto, mon("Raichu"), { eviolite: false, species: ["light-ball", "thick-club"] }))).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("ignores Eviolite when it does nothing for the pair", () => {
    const max = mon("Max", { canEvolve: true, isMax: true });
    expect(all(i => battleMultiplier(i, max, clamperl, { eviolite: true, species: [] }))).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

describe("battleStat", () => {
  it("rounds down, as the game does", () => {
    expect(battleStat(237, 1.5)).toBe(355); // 355.5
    expect(battleStat(237, 1.25)).toBe(296); // 296.25
    expect(battleStat(237, 4)).toBe(948);
  });

  it("leaves the stat alone at a multiplier of 1 and never goes below 1", () => {
    expect(battleStat(237, 1)).toBe(237);
    expect(battleStat(1, 1.25)).toBe(1);
    expect(battleStat(0, 2)).toBe(1);
  });
});
