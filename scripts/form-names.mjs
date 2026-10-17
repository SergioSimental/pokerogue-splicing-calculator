/**
 * Works out the name PokeRogue feeds into its fusion-name function for one species or form.
 *
 * In the game, species.getName(formIndex) returns the plain species name from the English locale
 * file (en/pokemon.json), except that Mega, Primal, G-Max and E-Max forms are wrapped in a template
 * from en/pokemon-form-battle.json ("Mega {{pokemonName}}", "G-Max {{pokemonName}}", ...).
 * Regional species such as Alolan Raichu are simply "Raichu" there. This mirrors that logic.
 * Kept in its own file (no side effects) so tests can import it without running the update script.
 */

// Mirrors SpeciesFormKey in PokeRogue's src/enums/species-form-key.ts.
const FORM_KEY_ENUM = {
  MEGA: "mega", MEGA_X: "mega-x", MEGA_Y: "mega-y", MEGA_Z: "mega-z",
  MEGA_ORIGINAL: "mega-original", MEGA_CURLY: "mega-curly", MEGA_DROOPY: "mega-droopy", MEGA_STRETCHY: "mega-stretchy",
  PRIMAL: "primal", ORIGIN: "origin", INCARNATE: "incarnate", THERIAN: "therian",
  GIGANTAMAX: "gigantamax", GIGANTAMAX_SINGLE: "gigantamax-single", GIGANTAMAX_RAPID: "gigantamax-rapid",
  ETERNAMAX: "eternamax",
};

const toCamelCase = s => s.split("-").map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join("");

/**
 * Turns the raw formKey text from a species file into the form key string.
 * Accepts `SpeciesFormKey.MEGA_X`, a string literal such as `"therian"`, or nothing (the base form).
 * Returns null for something it does not recognise (for example a new SpeciesFormKey member).
 */
export function resolveFormKey(raw) {
  if (raw === null || raw === undefined) return "";
  const text = raw.trim();
  const member = /^SpeciesFormKey\.(\w+)$/.exec(text);
  if (member) return FORM_KEY_ENUM[member[1]] ?? null;
  const literal = /^"(.*)"$/.exec(text);
  return literal ? literal[1] : null;
}

/** Which template in en/pokemon-form-battle.json the game uses for this form key, or null for none. */
export function formTemplateKey(formKey) {
  switch (formKey) {
    case "mega":
    case "primal":
    case "eternamax":
    case "mega-x":
    case "mega-y":
    case "mega-z":
      return toCamelCase(formKey);
    case "mega-original":
    case "mega-curly":
    case "mega-droopy":
    case "mega-stretchy":
      return "mega";
    default:
      return formKey.includes("gigantamax") ? "gigantamax" : null;
  }
}

/**
 * The name the game uses for this species/form when it builds a fusion name.
 * `templates` is the parsed en/pokemon-form-battle.json.
 */
export function formName(speciesName, rawFormKey, templates, label, warn = console.warn) {
  const formKey = resolveFormKey(rawFormKey);
  if (formKey === null) {
    warn(`${label}: unrecognised form key ${rawFormKey}; using the plain species name`);
    return speciesName;
  }
  const templateKey = formTemplateKey(formKey);
  if (templateKey === null) return speciesName;
  const template = templates[templateKey];
  if (typeof template !== "string" || !template.includes("{{pokemonName}}")) {
    throw new Error(`${label}: no usable "${templateKey}" template in the form-name locale file. Did the upstream format change?`);
  }
  return template.replaceAll("{{pokemonName}}", speciesName);
}
