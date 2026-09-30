import { fuse } from "./fuse.js";
import { STAT_NAMES } from "./types.js";
const COLORS = {
    Normal: "#8a8a72", Fire: "#e2622a", Water: "#4a7fd6", Electric: "#c9a010",
    Grass: "#4f9a3c", Ice: "#5aa9a9", Fighting: "#a5302a", Poison: "#8d3a9a",
    Ground: "#b8935a", Flying: "#7a70d6", Psychic: "#d63f74", Bug: "#829412",
    Rock: "#94802a", Ghost: "#65508a", Dragon: "#5b2fd0", Dark: "#5a463a",
    Steel: "#6d6d8a", Fairy: "#c96a8a",
};
const MAX_STAT = 255;
let dex = [];
function el(id) {
    const node = document.getElementById(id);
    if (!node)
        throw new Error(`Missing element #${id}`);
    return node;
}
const primarySelect = el("primary");
const secondarySelect = el("secondary");
const result = el("result");
const pct = (v) => `${(v / MAX_STAT) * 100}%`;
function render() {
    const primary = dex[Number(primarySelect.value)];
    const secondary = dex[Number(secondarySelect.value)];
    if (!primary || !secondary)
        return;
    const f = fuse(primary, secondary);
    const rows = STAT_NAMES.map((name, i) => {
        const p = primary.stats[i] ?? 0, s = secondary.stats[i] ?? 0, v = f.stats[i] ?? 0;
        return `<div class="stat"><span>${name}</span><strong>${v}</strong>
      <div class="track"><div class="fill" style="width:${pct(v)}"></div>
        <span class="tick p" title="${primary.name}: ${p}" style="left:calc(${pct(p)} - 2px)"></span>
        <span class="tick s" title="${secondary.name}: ${s}" style="left:calc(${pct(s)} - 2px)"></span>
      </div></div>`;
    }).join("");
    const total = f.stats.reduce((a, b) => a + b, 0);
    const chips = f.types.map(t => `<span class="type" style="background:${COLORS[t]}">${t}</span>`).join("");
    result.innerHTML = `<h2>${primary.name} + ${secondary.name}</h2>
    <div class="types">${chips}</div>${rows}
    <div class="total">Base stat total: ${total}</div>
    <div class="legend">Markers show the <b>primary</b> and <b>secondary</b> values.</div>`;
}
async function init() {
    try {
        const res = await fetch("data/pokemon.json");
        if (!res.ok)
            throw new Error(String(res.status));
        dex = (await res.json());
    }
    catch {
        result.textContent = "Could not load data/pokemon.json. Serve the folder with a local web server (see README).";
        return;
    }
    dex.sort((a, b) => a.name.localeCompare(b.name));
    const opts = dex.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");
    primarySelect.innerHTML = secondarySelect.innerHTML = opts;
    primarySelect.value = String(Math.max(0, dex.findIndex(p => p.name === "Charizard")));
    secondarySelect.value = String(Math.max(0, dex.findIndex(p => p.name === "Garchomp")));
    primarySelect.onchange = secondarySelect.onchange = render;
    el("swap").onclick = () => {
        [primarySelect.value, secondarySelect.value] = [secondarySelect.value, primarySelect.value];
        render();
    };
    render();
}
void init();
