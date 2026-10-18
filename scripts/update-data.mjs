#!/usr/bin/env node
/**
 * Regenerates data/pokemon.json from PokeRogue's source code.
 *
 * Reads src/data/balance/species/generation-NN.ts from the upstream repo,
 * pulls out each species' types, base stats, regular and hidden abilities and passive
 * ability (plus alternate forms whose types, stats or passive differ from the base
 * species), and writes the result.
 * Ability display names come from PokeRogue's English locale file.
 *
 * Usage:   node scripts/update-data.mjs
 * Options: POKEROGUE_REF=<branch|tag|sha>          which upstream ref to read (default: main)
 *          POKEROGUE_LOCALE_REF=<branch|tag|sha>   which ref of the locales repo to read (default: main)
 *
 * Needs Node 18+ (built-in fetch). The output file is only replaced when every
 * sanity check passes, so a failed run never leaves bad data behind.
 */
import dns from "node:dns";
import { readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { readAbilities } from "./abilities-parser.mjs";
import { formName } from "./form-names.mjs";

// Some networks reset Node's IPv6 connections to GitHub (ECONNRESET) while IPv4 works fine.
// Same effect as running node with --dns-result-order=ipv4first --no-network-family-autoselection.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const REPO = "pagefaultgames/pokerogue";
const REF = process.env.POKEROGUE_REF || "main";
const BASE_URL = `https://raw.githubusercontent.com/${REPO}/${REF}/src/data/balance/species`;
const OUTPUT = fileURLToPath(new URL("../data/pokemon.json", import.meta.url));
const LOCALE_BASE = `https://raw.githubusercontent.com/pagefaultgames/pokerogue-locales/${process.env.POKEROGUE_LOCALE_REF || "main"}/en`;
const LOCALE_URL = `${LOCALE_BASE}/ability.json`;
const SPECIES_LOCALE_URL = `${LOCALE_BASE}/pokemon.json`; // species names, as the game uses them
const FORM_LOCALE_URL = `${LOCALE_BASE}/pokemon-form-battle.json`; // "Mega {{pokemonName}}" and friends
const MAX_GENERATIONS = 20; // stops at the first missing file, so new generations are picked up automatically
const MIN_ENTRIES = 1000; // guard against upstream restructuring the files
// Ability sanity checks. Today about 79% of entries have a hidden ability and 43% have two regular
// abilities; these floors sit far below that, so a rebalance passes but a parse that quietly loses
// a whole ability slot (every entry suddenly "has none") fails the run instead of being written out.
const MIN_HIDDEN_SHARE = 0.4;
const MIN_TWO_REGULAR_SHARE = 0.15;

const TYPES = new Set([
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground",
  "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy",
]);

// Upstream only has internal IDs (e.g. HO_OH), so display names are generated here.
const SPECIAL_NAMES = {
  NIDORAN_F: "Nidoran♀", NIDORAN_M: "Nidoran♂", MR_MIME: "Mr. Mime", MR_RIME: "Mr. Rime",
  MIME_JR: "Mime Jr.", PORYGON2: "Porygon2", PORYGON_Z: "Porygon-Z", HO_OH: "Ho-Oh",
  TYPE_NULL: "Type: Null", JANGMO_O: "Jangmo-o", HAKAMO_O: "Hakamo-o", KOMMO_O: "Kommo-o",
  WO_CHIEN: "Wo-Chien", CHIEN_PAO: "Chien-Pao", TING_LU: "Ting-Lu", CHI_YU: "Chi-Yu",
  FARFETCHD: "Farfetch'd", SIRFETCHD: "Sirfetch'd", FLABEBE: "Flabébé",
  ETERNAL_FLOETTE: "Floette (Eternal Flower)", BATTLE_BOND_GRENINJA: "Greninja (Battle Bond)",
  GALAR_MR_MIME: "Galarian Mr. Mime", GALAR_FARFETCHD: "Galarian Farfetch'd",
};
const REGION_PREFIXES = { ALOLA_: "Alolan ", GALAR_: "Galarian ", HISUI_: "Hisuian ", PALDEA_: "Paldean " };

const capitalize = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

function displayName(id) {
  if (SPECIAL_NAMES[id]) return SPECIAL_NAMES[id];
  for (const [prefix, label] of Object.entries(REGION_PREFIXES)) {
    if (id.startsWith(prefix)) return label + displayName(id.slice(prefix.length));
  }
  return id.split("_").map(capitalize).join(" ");
}

const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 30_000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Node reports every network failure as just "fetch failed"; the useful part is in err.cause. */
function describeError(err) {
  const cause = err?.cause?.code ?? err?.cause?.message ?? err?.name;
  return cause && cause !== err.message ? `${err.message} (${cause})` : String(err?.message ?? err);
}

/**
 * Downloads a text file. Returns null for a 404. Retries a few times on network errors,
 * timeouts, rate limiting (429) and server errors (5xx); other HTTP errors fail immediately.
 */
async function fetchText(url) {
  const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  let lastError;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
      lastError = new Error(`HTTP ${res.status} ${res.statusText}`);
      if (res.status < 500 && res.status !== 429) break; // retrying will not help
    } catch (err) {
      lastError = err;
    }
    if (attempt < FETCH_ATTEMPTS) {
      console.warn(`  ${describeError(lastError)}; retrying (${attempt}/${FETCH_ATTEMPTS - 1})...`);
      await sleep(attempt * 1000);
    }
  }
  throw new Error(`Could not download ${url}: ${describeError(lastError)}. Check your internet connection, VPN or firewall, then try again.`);
}

async function loadGenerations() {
  const files = [];
  for (let n = 1; n <= MAX_GENERATIONS; n++) {
    const url = `${BASE_URL}/generation-${String(n).padStart(2, "0")}.ts`;
    const text = await fetchText(url);
    if (text === null) {
      if (n === 1) throw new Error(`Could not find ${url}. Did the upstream file layout change, or is "${REF}" a valid ref?`);
      break;
    }
    files.push(text);
    console.log(`Fetched generation ${n}`);
  }
  return files;
}

function field(block, key) {
  const m = block.match(new RegExp(`\\b${key}:\\s*([^,\\n]+)`));
  return m ? m[1].trim() : null;
}

function typeName(raw, label) {
  if (raw === null || raw === "null") return null;
  const t = capitalize(raw.replace("PokemonType.", ""));
  if (!TYPES.has(t)) throw new Error(`${label}: unknown type "${raw}"`);
  return t;
}

/** Reads types and base stats from one species/form block. */
function readEntry(block, label) {
  const type1 = typeName(field(block, "type1"), label);
  if (!type1) throw new Error(`${label}: missing type1`);
  const type2 = typeName(field(block, "type2"), label);
  const stats = ["baseHp", "baseAtk", "baseDef", "baseSpatk", "baseSpdef", "baseSpd"].map(k => Number(field(block, k)));
  if (stats.some(n => !Number.isInteger(n) || n < 0)) throw new Error(`${label}: missing or invalid base stats`);
  const declaredTotal = Number(field(block, "baseTotal"));
  if (Number.isFinite(declaredTotal) && declaredTotal !== stats.reduce((a, b) => a + b, 0)) {
    console.warn(`Warning: ${label} has base stats that do not add up to its declared baseTotal`);
  }
  return { stats, types: type2 ? [type1, type2] : [type1] };
}

/** Official English ability names, keyed like "speedBoost". Falls back to generated names if unavailable. */
/**
 * Loads a locale file that fusion names depend on. Unlike ability names there is no safe fallback
 * (a guessed name would be wrong, e.g. for Alolan forms), so any problem stops the run and leaves
 * data/pokemon.json untouched.
 */
async function loadRequiredLocale(url, what) {
  console.log(`Fetching ${what}`);
  const text = await fetchText(url);
  if (text === null) {
    throw new Error(`Could not find ${what} at ${url}. To read a different branch or tag, set POKEROGUE_LOCALE_REF.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${what} is not valid JSON`);
  }
}

async function loadAbilityNames() {
  try {
    const text = await fetchText(LOCALE_URL);
    if (text === null) throw new Error("file not found");
    const names = {};
    for (const [key, value] of Object.entries(JSON.parse(text))) {
      if (typeof value?.name === "string") names[key] = value.name;
    }
    return names;
  } catch (err) {
    console.warn(`Warning: could not load official ability names (${err.message}); using generated names instead.`);
    return {};
  }
}

const camelCase = id => {
  const [first, ...rest] = id.toLowerCase().split("_");
  return first + rest.map(capitalize).join("");
};

/**
 * Reads a species' passive ability. Upstream stores either one ability for every form,
 * or an object keyed by form number. A form with no entry uses the base form's passive,
 * which is the same rule the game applies.
 */
function readPassives(segment, id) {
  const single = segment.match(/\bpassives:\s*AbilityId\.(\w+)/);
  if (single) return () => single[1];
  const object = segment.match(/\bpassives:\s*\{([^}]*)\}/);
  if (!object) throw new Error(`${id}: no passives field found. Did the upstream format change?`);
  const byForm = new Map([...object[1].matchAll(/(\d+):\s*AbilityId\.(\w+)/g)].map(m => [Number(m[1]), m[2]]));
  if (!byForm.has(0)) throw new Error(`${id}: passives has no entry for the base form`);
  return formIndex => byForm.get(formIndex) ?? byForm.get(0);
}

function parseGeneration(text) {
  const parts = text.split(/generation\w+SpeciesData\[SpeciesId\.(\w+)\]\s*=\s*\{/);
  const entries = [];
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const segment = parts[i + 1];
    const firstForm = segment.indexOf("new PokemonForm(");
    const head = firstForm < 0 ? segment : segment.slice(0, firstForm);
    const forms = [...segment.matchAll(/new PokemonForm\(\{([\s\S]*?)\n\s*\}\)/g)].map(m => m[1]);
    entries.push({ id, head, forms, segment });
  }
  return entries;
}

function buildDataset(generations, abilityNames, speciesNames, formTemplates) {
  const out = [];
  const generatedNames = new Set();
  const nameOf = abilityId => {
    const official = abilityNames[camelCase(abilityId)];
    if (official) return official;
    generatedNames.add(abilityId);
    return abilityId.split("_").map(capitalize).join(" ");
  };

  for (const text of generations) {
    for (const { id, head, forms, segment } of parseGeneration(text)) {
      const baseName = displayName(id);
      // The name PokeRogue itself uses for this species (Alolan Raichu is just "Raichu" there).
      const speciesName = speciesNames[camelCase(id)];
      if (typeof speciesName !== "string" || speciesName.trim() === "") {
        throw new Error(`${id}: no English name in the species locale file. Did the upstream format change?`);
      }
      const passiveFor = readPassives(segment, id);
      const base = { ...readEntry(head, id), passive: nameOf(passiveFor(0)), abilities: readAbilities(head, id, nameOf) };
      out.push({ name: baseName, fusionName: speciesName, ...base });

      // Keep an alternate form only when its types, stats or passive differ from every earlier
      // entry of the species. Forms that are identical in all three would just add duplicates.
      const keyOf = e => JSON.stringify([e.stats, e.types, e.passive]);
      const seen = new Set([keyOf(base)]);
      forms.forEach((block, formIndex) => {
        const formLabel = field(block, "formName")?.replace(/^"|"$/g, "")
          || capitalize((field(block, "formKey") ?? "form").split(".").pop());
        const formId = `${id} (${formLabel})`;
        const form = {
          ...readEntry(block, formId),
          passive: nameOf(passiveFor(formIndex)),
          abilities: readAbilities(block, formId, nameOf),
        };
        if (seen.has(keyOf(form))) return;
        seen.add(keyOf(form));
        const fusionName = formName(speciesName, field(block, "formKey"), formTemplates, formId);
        out.push({ name: `${baseName} (${formLabel})`, fusionName, ...form });
      });
    }
  }
  if (generatedNames.size > 0) {
    console.warn(`Warning: no official name for ${[...generatedNames].join(", ")}; used generated names.`);
  }
  return out;
}

function validate(data) {
  if (data.length < MIN_ENTRIES) {
    throw new Error(`Only ${data.length} entries found (expected at least ${MIN_ENTRIES}). Upstream file layout probably changed.`);
  }
  const names = new Set();
  for (const e of data) {
    if (names.has(e.name)) throw new Error(`Duplicate name: ${e.name}`);
    names.add(e.name);
    if (typeof e.passive !== "string" || e.passive === "") throw new Error(`${e.name}: missing passive`);
    if (typeof e.fusionName !== "string" || e.fusionName.trim() === "" || e.fusionName.includes("{{")) {
      throw new Error(`${e.name}: missing or unfinished fusion name`);
    }
    const { regular, hidden } = e.abilities ?? {};
    if (!Array.isArray(regular) || regular.length < 1 || regular.length > 2 || regular.some(a => typeof a !== "string" || a === "")) {
      throw new Error(`${e.name}: needs one or two regular abilities`);
    }
    if (hidden !== null && (typeof hidden !== "string" || hidden === "")) throw new Error(`${e.name}: invalid hidden ability`);
  }
  const share = test => data.filter(test).length / data.length;
  if (share(e => e.abilities.hidden !== null) < MIN_HIDDEN_SHARE) {
    throw new Error("Hardly any entries have a hidden ability. The abilityHidden format upstream probably changed.");
  }
  if (share(e => e.abilities.regular.length === 2) < MIN_TWO_REGULAR_SHARE) {
    throw new Error("Hardly any entries have two regular abilities. The ability2 format upstream probably changed.");
  }
}

/** One entry per line, so changes show up as readable diffs in git. */
function serialize(data) {
  return `[\n${data.map(e => JSON.stringify(e)).join(",\n")}\n]\n`;
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(OUTPUT, "utf8"));
  } catch {
    return [];
  }
}

function summarize(oldData, newData) {
  const oldMap = new Map(oldData.map(e => [e.name, JSON.stringify(e)]));
  const newMap = new Map(newData.map(e => [e.name, JSON.stringify(e)]));
  const added = [...newMap.keys()].filter(n => !oldMap.has(n));
  const removed = [...oldMap.keys()].filter(n => !newMap.has(n));
  const changed = [...newMap.keys()].filter(n => oldMap.has(n) && oldMap.get(n) !== newMap.get(n));
  const list = arr => (arr.length ? `: ${arr.slice(0, 10).join(", ")}${arr.length > 10 ? ", ..." : ""}` : "");
  console.log(`Added ${added.length}${list(added)}`);
  console.log(`Removed ${removed.length}${list(removed)}`);
  console.log(`Changed ${changed.length}${list(changed)}`);
}

async function main() {
  console.log(`Reading ${REPO}@${REF}`);
  const data = buildDataset(
    await loadGenerations(),
    await loadAbilityNames(),
    await loadRequiredLocale(SPECIES_LOCALE_URL, "the species name locale file"),
    await loadRequiredLocale(FORM_LOCALE_URL, "the form name locale file"),
  );
  validate(data);

  const oldData = await readExisting();
  const output = serialize(data);
  let previous = "";
  try { previous = await readFile(OUTPUT, "utf8"); } catch { /* first run */ }

  if (output === previous) {
    console.log(`No changes (${data.length} entries).`);
    return;
  }
  summarize(oldData, data);
  await writeFile(OUTPUT, output, "utf8");
  console.log(`Wrote ${data.length} entries to data/pokemon.json`);
}

main().catch(err => {
  console.error(`\nUpdate failed: ${err.message}`);
  console.error("data/pokemon.json was left unchanged.");
  process.exit(1);
});
