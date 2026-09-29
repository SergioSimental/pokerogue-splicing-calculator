import { fuse } from "./fuse.js";
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
const headSelect = el<HTMLSelectElement>("head");
const bodySelect = el<HTMLSelectElement>("body");
const result = el<HTMLElement>("result");

const pct = (v: number) => `${(v / MAX_STAT) * 100}%`;

function render(): void {
  const head = dex[Number(headSelect.value)];
  const body = dex[Number(bodySelect.value)];
  if (!head || !body) return;
  const f = fuse(head, body);

  const rows = STAT_NAMES.map((name, i) => {
    const h = head.stats[i] ?? 0, b = body.stats[i] ?? 0, v = f.stats[i] ?? 0;
    return `<div class="stat"><span>${name}</span><strong>${v}</strong>
      <div class="track"><div class="fill" style="width:${pct(v)}"></div>
        <span class="tick h" title="${head.name}: ${h}" style="left:calc(${pct(h)} - 2px)"></span>
        <span class="tick b" title="${body.name}: ${b}" style="left:calc(${pct(b)} - 2px)"></span>
      </div></div>`;
  }).join("");

  const total = f.stats.reduce((a, b) => a + b, 0);
  const chips = f.types.map(t => `<span class="type" style="background:${COLORS[t]}">${t}</span>`).join("");
  result.innerHTML = `<h2>${head.name} + ${body.name}</h2>
    <div class="types">${chips}</div>${rows}
    <div class="total">Base stat total: ${total}</div>
    <div class="legend">Markers show the <b>head</b> and <b>body</b> values.</div>`;
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
  const opts = dex.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");
  headSelect.innerHTML = bodySelect.innerHTML = opts;
  headSelect.value = String(Math.max(0, dex.findIndex(p => p.name === "Charizard")));
  bodySelect.value = String(Math.max(0, dex.findIndex(p => p.name === "Garchomp")));
  headSelect.onchange = bodySelect.onchange = render;
  el("swap").onclick = () => {
    [headSelect.value, bodySelect.value] = [bodySelect.value, headSelect.value];
    render();
  };
  render();
}

void init();
