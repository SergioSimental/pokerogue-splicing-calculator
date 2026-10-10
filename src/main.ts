import { clampIv, clampLevel, fuse, statAtLevel } from "./fuse.js";
import { NATURES, natureLabel, natureMultiplier } from "./natures.js";
import { STAT_NAMES, type Pokemon, type PokemonType } from "./types.js";

const COLORS: Record<PokemonType, string> = {
  Normal: "#8a8a72", Fire: "#e2622a", Water: "#4a7fd6", Electric: "#c9a010",
  Grass: "#4f9a3c", Ice: "#5aa9a9", Fighting: "#a5302a", Poison: "#8d3a9a",
  Ground: "#b8935a", Flying: "#7a70d6", Psychic: "#d63f74", Bug: "#829412",
  Rock: "#94802a", Ghost: "#65508a", Dragon: "#5b2fd0", Dark: "#5a463a",
  Steel: "#6d6d8a", Fairy: "#c96a8a",
};
const MAX_STAT = 255;

let dex: Pokemon[] = [];

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}
const primarySelect = el<HTMLSelectElement>("primary");
const secondarySelect = el<HTMLSelectElement>("secondary");
const levelInput = el<HTMLInputElement>("level");
const ivInputs = STAT_NAMES.map((_, i) => el<HTMLInputElement>(`iv${i}`));
const natureSelect = el<HTMLSelectElement>("nature");
const primaryFilter = el<HTMLInputElement>("primary-filter");
const secondaryFilter = el<HTMLInputElement>("secondary-filter");
const natureFilter = el<HTMLInputElement>("nature-filter");
const result = el<HTMLElement>("result");

const fmt = (n: number) => n.toLocaleString("en-US");

interface Choice {
  label: string;
  /** Lowercase, accent-free text the filter searches. */
  text: string;
}

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Fills a select with the choices that match the query. Option values are indexes into
 * `choices`, so the rest of the app is unaffected by filtering. Keeps the current selection
 * if it still matches, otherwise selects the first match. Returns false when nothing matches.
 */
function populate(select: HTMLSelectElement, choices: Choice[], query: string): boolean {
  const q = normalize(query.trim());
  const previous = select.value;
  const matches = choices.map((c, i) => ({ c, i })).filter(({ c }) => c.text.includes(q));
  if (matches.length === 0) {
    select.innerHTML = '<option value="" disabled selected>No matches</option>';
    return false;
  }
  select.innerHTML = matches.map(({ c, i }) => `<option value="${i}">${c.label}</option>`).join("");
  select.value = matches.some(({ i }) => String(i) === previous) ? previous : String(matches[0]?.i ?? 0);
  return true;
}

function attachFilter(select: HTMLSelectElement, input: HTMLInputElement, choices: Choice[], onChange: () => void): void {
  input.addEventListener("input", () => {
    if (populate(select, choices, input.value)) onChange();
  });
}

const natureChoices: Choice[] = NATURES.map(n => ({ label: natureLabel(n), text: normalize(natureLabel(n)) }));
const CONTROL_KEYS = new Set([
  "Backspace", "Delete", "Tab", "Enter", "Escape",
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End",
]);

/** Block every key except 0-9 (and editing/navigation keys) from reaching the box. */
function restrictToDigits(input: HTMLInputElement): void {
  input.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey || CONTROL_KEYS.has(e.key)) return;
    if (e.key.length === 1 && !/[0-9]/.test(e.key)) e.preventDefault();
  });
  // Covers on-screen keyboards, where keydown does not report the real key.
  input.addEventListener("beforeinput", e => {
    if (e.data && /\D/.test(e.data)) e.preventDefault();
  });
  // Pasted text keeps digits only.
  input.addEventListener("paste", e => {
    e.preventDefault();
    const digits = (e.clipboardData?.getData("text") ?? "").replace(/\D/g, "");
    if (digits) {
      input.value = digits;
      input.dispatchEvent(new Event("input"));
    }
  });
}

const pct = (v: number) => `${(v / MAX_STAT) * 100}%`;

function render(): void {
  const primary = dex[Number(primarySelect.value)];
  const secondary = dex[Number(secondarySelect.value)];
  if (!primary || !secondary || !primarySelect.value || !secondarySelect.value) return;
  const f = fuse(primary, secondary);
  const level = clampLevel(Number(levelInput.value));
  const ivs = ivInputs.map(input => clampIv(Number(input.value)));
  const atLevel = f.stats.map((v, i) => statAtLevel(i, v, level, ivs[i] ?? 0, natureMultiplier(NATURES[Number(natureSelect.value)], i)));

  const rows = STAT_NAMES.map((name, i) => {
    const p = primary.stats[i] ?? 0, s = secondary.stats[i] ?? 0, v = f.stats[i] ?? 0;
    return `<div class="stat"><span>${name}</span>
      <div class="track"><div class="fill" style="width:${pct(v)}"></div>
        <span class="tick p" title="${primary.name}: ${p}" style="left:calc(${pct(p)} - 2px)"></span>
        <span class="tick s" title="${secondary.name}: ${s}" style="left:calc(${pct(s)} - 2px)"></span>
      </div><span class="lvl">${fmt(atLevel[i] ?? 0)}</span></div>`;
  }).join("");

  const levelTotal = atLevel.reduce((a, b) => a + b, 0);
  const chips = f.types.map(t => `<span class="type" style="background:${COLORS[t]}">${t}</span>`).join("");
  result.innerHTML = `<h2>${primary.name} + ${secondary.name}</h2>
    <div class="types">${chips}</div>
    <div class="stat labels"><span></span><span></span><span class="lvl">Lv ${fmt(level)}</span></div>${rows}
    <div class="total">Total at Lv ${fmt(level)}: ${fmt(levelTotal)}</div>
    <div class="legend">Markers show the <b>primary</b> and <b>secondary</b> values.</div>`;
}

async function init(): Promise<void> {
  try {
    const res = await fetch("data/pokemon.json");
    if (!res.ok) throw new Error(String(res.status));
    dex = (await res.json()) as Pokemon[];
  } catch {
    result.textContent = "Could not load data/pokemon.json. Serve the folder with a local web server (see README).";
    return;
  }
  dex.sort((a, b) => a.name.localeCompare(b.name));
  const dexChoices: Choice[] = dex.map(p => ({ label: p.name, text: normalize(`${p.name} ${p.types.join(" ")}`) }));
  populate(primarySelect, dexChoices, "");
  populate(secondarySelect, dexChoices, "");
  attachFilter(primarySelect, primaryFilter, dexChoices, render);
  attachFilter(secondarySelect, secondaryFilter, dexChoices, render);
  primarySelect.value = String(Math.max(0, dex.findIndex(p => p.name === "Charizard")));
  secondarySelect.value = String(Math.max(0, dex.findIndex(p => p.name === "Garchomp")));
  primarySelect.onchange = secondarySelect.onchange = render;
  for (const input of ivInputs) {
    input.oninput = render;
    input.onchange = () => {
      input.value = String(clampIv(Number(input.value)));
      render();
    };
  }
  natureSelect.onchange = render;
  levelInput.oninput = render;
  levelInput.onchange = () => {
    levelInput.value = String(clampLevel(Number(levelInput.value)));
    render();
  };
  el("swap").onclick = () => {
    const [a, b] = [primarySelect.value, secondarySelect.value];
    if (!a || !b) return;
    // Clear the filters first so both lists contain every Pokémon before swapping.
    primaryFilter.value = secondaryFilter.value = "";
    populate(primarySelect, dexChoices, "");
    populate(secondarySelect, dexChoices, "");
    primarySelect.value = b;
    secondarySelect.value = a;
    render();
  };
  render();
}

// Attach key blocking immediately, even if the data file fails to load.
for (const input of [levelInput, ...ivInputs]) restrictToDigits(input);
populate(natureSelect, natureChoices, "");
attachFilter(natureSelect, natureFilter, natureChoices, render);

void init();
