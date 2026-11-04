import { describe, expect, it, vi } from "vitest";
import { formName, formTemplateKey, isMaxForm, resolveFormKey } from "../scripts/form-names.mjs";

// The templates PokeRogue's English locale (pokemon-form-battle.json) uses, trimmed to what matters.
const TEMPLATES = {
  mega: "Mega {{pokemonName}}",
  megaX: "Mega {{pokemonName}} X",
  megaY: "Mega {{pokemonName}} Y",
  megaZ: "Mega {{pokemonName}} Z",
  primal: "Primal {{pokemonName}}",
  gigantamax: "G-Max {{pokemonName}}",
  eternamax: "E-Max {{pokemonName}}",
};

describe("resolveFormKey", () => {
  it("reads SpeciesFormKey members, string literals and a missing key", () => {
    expect(resolveFormKey("SpeciesFormKey.MEGA_X")).toBe("mega-x");
    expect(resolveFormKey("SpeciesFormKey.GIGANTAMAX_SINGLE")).toBe("gigantamax-single");
    expect(resolveFormKey('"therian"')).toBe("therian");
    expect(resolveFormKey('""')).toBe("");
    expect(resolveFormKey(null)).toBe("");
  });

  it("returns null for a member or expression it does not know", () => {
    expect(resolveFormKey("SpeciesFormKey.MEGA_W")).toBeNull();
    expect(resolveFormKey("someVariable")).toBeNull();
  });
});

describe("formTemplateKey", () => {
  it("picks the template the game picks", () => {
    expect(formTemplateKey("mega")).toBe("mega");
    expect(formTemplateKey("mega-x")).toBe("megaX");
    expect(formTemplateKey("mega-z")).toBe("megaZ");
    expect(formTemplateKey("primal")).toBe("primal");
    expect(formTemplateKey("eternamax")).toBe("eternamax");
  });

  it("uses the plain mega template for the special Megas, and one G-Max template for every G-Max", () => {
    for (const key of ["mega-original", "mega-curly", "mega-droopy", "mega-stretchy"]) expect(formTemplateKey(key)).toBe("mega");
    for (const key of ["gigantamax", "gigantamax-single", "gigantamax-rapid"]) expect(formTemplateKey(key)).toBe("gigantamax");
  });

  it("gives no template to ordinary forms", () => {
    for (const key of ["", "therian", "origin", "poke-ball", "zen"]) expect(formTemplateKey(key)).toBeNull();
  });
});

describe("formName", () => {
  const name = (species: string, raw: string | null) => formName(species, raw, TEMPLATES, "Test", vi.fn());

  it("leaves ordinary and base forms as the plain species name", () => {
    expect(name("Garchomp", '""')).toBe("Garchomp");
    expect(name("Tornadus", '"therian"')).toBe("Tornadus");
    expect(name("Raichu", null)).toBe("Raichu");
  });

  it("wraps Mega, Primal, G-Max and E-Max forms", () => {
    expect(name("Charizard", "SpeciesFormKey.MEGA_X")).toBe("Mega Charizard X");
    expect(name("Venusaur", "SpeciesFormKey.MEGA")).toBe("Mega Venusaur");
    expect(name("Kyogre", '"primal"')).toBe("Primal Kyogre");
    expect(name("Urshifu", "SpeciesFormKey.GIGANTAMAX_RAPID")).toBe("G-Max Urshifu");
    expect(name("Eternatus", "SpeciesFormKey.ETERNAMAX")).toBe("E-Max Eternatus");
  });

  it("falls back to the plain name, with a warning naming the Pokémon, for an unknown form key", () => {
    const warn = vi.fn();
    expect(formName("Test", "SpeciesFormKey.MEGA_W", TEMPLATES, "Test (Mega W)", warn)).toBe("Test");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("Test (Mega W)");
  });

  it("throws, naming the Pokémon, when the template it needs is missing or has no placeholder", () => {
    expect(() => formName("X", "SpeciesFormKey.MEGA_X", {}, "X (Mega X)", vi.fn())).toThrow(/X \(Mega X\).*megaX/);
    expect(() => formName("X", "SpeciesFormKey.MEGA", { mega: "Mega" }, "X (Mega)", vi.fn())).toThrow(/mega/);
  });
});

describe("isMaxForm", () => {
  // The same four form keys PokeRogue's Pokemon.isMax() checks.
  it("is true for every Gigantamax kind and Eternamax", () => {
    for (const key of ["GIGANTAMAX", "GIGANTAMAX_SINGLE", "GIGANTAMAX_RAPID", "ETERNAMAX"]) {
      expect(isMaxForm(`SpeciesFormKey.${key}`), key).toBe(true);
    }
    expect(isMaxForm('"gigantamax-single"')).toBe(true);
  });

  it("is false for the base form, Mega and Primal forms and everything else", () => {
    expect(isMaxForm(null)).toBe(false);
    expect(isMaxForm("SpeciesFormKey.MEGA_X")).toBe(false);
    expect(isMaxForm("SpeciesFormKey.PRIMAL")).toBe(false);
    expect(isMaxForm('"therian"')).toBe(false);
  });

  it("is false for a key it does not recognise", () => {
    expect(isMaxForm("SpeciesFormKey.SOMETHING_NEW")).toBe(false);
    expect(isMaxForm("someVariable")).toBe(false);
  });
});
