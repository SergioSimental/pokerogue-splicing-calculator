#!/usr/bin/env node
/**
 * Regenerates data/pokemon.json from PokeRogue's source code.
 *
 * Reads src/data/balance/species/generation-NN.ts from the upstream repo,
 * pulls out each species' types and base stats (plus alternate forms whose
 * types or stats differ from the base species), and writes the result.
 *
 * Usage:   node scripts/update-data.mjs
 * Options: POKEROGUE_REF=<branch|tag|sha>   which upstream ref to read (default: main)
 *
 * Needs Node 18+ (built-in fetch). The output file is only replaced when every
 * sanity check passes, so a failed run never leaves bad data behind.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const REPO = "pagefaultgames/pokerogue";
const REF = process.env.POKEROGUE_REF || "main";
const BASE_URL = `https://raw.githubusercontent.com/${REPO}/${REF}/src/data/balance/species`;
const OUTPUT = fileURLToPath(new URL("../data/pokemon.json", import.meta.url));
const MAX_GENERATIONS = 20; // stops at the first missing file, so new generations are picked up automatically
const MIN_ENTRIES = 1000; // guard against upstream restructuring the files

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

async function fetchText(url) {
  const headers = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return res.text();
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

function parseGeneration(text) {
  const parts = text.split(/generation\w+SpeciesData\[SpeciesId\.(\w+)\]\s*=\s*\{/);
  const entries = [];
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const segment = parts[i + 1];
    const firstForm = segment.indexOf("new PokemonForm(");
    const head = firstForm < 0 ? segment : segment.slice(0, firstForm);
    const forms = [...segment.matchAll(/new PokemonForm\(\{([\s\S]*?)\n\s*\}\)/g)].map(m => m[1]);
    entries.push({ id, head, forms });
  }
  return entries;
}

function buildDataset(generations) {
  const out = [];
  for (const text of generations) {
    for (const { id, head, forms } of parseGeneration(text)) {
      const baseName = displayName(id);
      const base = readEntry(head, id);
      out.push({ name: baseName, ...base });

      // Keep alternate forms only when they differ in types or stats; cosmetic forms
      // (Unown letters, Vivillon patterns...) would just duplicate the base species.
      const seen = new Set([JSON.stringify([base.stats, base.types])]);
      for (const block of forms) {
        const formLabel = field(block, "formName")?.replace(/^"|"$/g, "")
          || capitalize((field(block, "formKey") ?? "form").split(".").pop());
        const form = readEntry(block, `${id} (${formLabel})`);
        const key = JSON.stringify([form.stats, form.types]);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: `${baseName} (${formLabel})`, ...form });
      }
    }
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
  const data = buildDataset(await loadGenerations());
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
