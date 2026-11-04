import { abilityChoices } from "./abilities.js";
import { Combobox, normalize } from "./ui/combobox.js";
import { clampIv, clampLevel, fuse, statAtLevel } from "./fuse.js";
import { battleMultiplier, battleStat, clampCount, HELD_ITEM_LIMITS, SPECIES_ITEMS, speciesItemsFor } from "./heldItems.js";
import { fusedSpeciesName } from "./fusionName.js";
import { NATURES, natureLabel, natureMultiplier } from "./natures.js";
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
const primaryBox = new Combobox(el("primary"), el("primary-list"), render);
const secondaryBox = new Combobox(el("secondary"), el("secondary-list"), render);
const natureBox = new Combobox(el("nature"), el("nature-list"), render);
const levelInput = el("level");
const passiveToggle = el("passive-unlocked");
const abilitySelect = el("ability");
const ivInputs = STAT_NAMES.map((_, i) => el(`iv${i}`));
// Held item counts are kept to digits and clamped to the game's stack limits. Vitamins follow the
// order of the stats (HP Up = HP, Protein = Atk, ...), after Soul Dew and Macho Brace.
const heldItemInputs = [
    { input: el("soul-dew"), max: HELD_ITEM_LIMITS.soulDew },
    { input: el("macho-brace"), max: HELD_ITEM_LIMITS.machoBrace },
    ...STAT_NAMES.map((_, i) => ({ input: el(`vitamin${i}`), max: HELD_ITEM_LIMITS.vitamin })),
];
const evioliteBox = el("eviolite");
const result = el("result");
const speciesItemsBox = el("species-items");
// One checkbox per species-specific item, built once and shown only while a picked Pokémon can use it.
const speciesItemRows = new Map();
for (const item of SPECIES_ITEMS) {
    const box = h("input");
    box.type = "checkbox";
    box.id = `item-${item.id}`;
    const text = h("span");
    text.append(h("b", undefined, item.name), ` ${item.effect}`);
    const row = h("label", "item-check");
    row.hidden = true;
    row.append(box, text);
    speciesItemRows.set(item.id, { row, box });
    speciesItemsBox.append(row);
}
const fmt = (n) => n.toLocaleString("en-US");
const natureChoices = NATURES.map(n => ({ label: natureLabel(n), text: normalize(natureLabel(n)) }));
const CONTROL_KEYS = new Set([
    "Backspace", "Delete", "Tab", "Enter", "Escape",
    "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End",
]);
/** Block every key except 0-9 (and editing/navigation keys) from reaching the box. */
function restrictToDigits(input) {
    input.addEventListener("keydown", e => {
        if (e.ctrlKey || e.metaKey || e.altKey || CONTROL_KEYS.has(e.key))
            return;
        if (e.key.length === 1 && !/[0-9]/.test(e.key))
            e.preventDefault();
    });
    // Covers on-screen keyboards, where keydown does not report the real key.
    input.addEventListener("beforeinput", e => {
        if (e.data && /\D/.test(e.data))
            e.preventDefault();
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
const pct = (v) => `${(v / MAX_STAT) * 100}%`;
/** Creates an element whose text is set with textContent (never parsed as HTML). */
function h(tag, className, text) {
    const node = document.createElement(tag);
    if (className)
        node.className = className;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
function marker(className, title, position) {
    const node = h("span", className);
    node.title = title;
    node.style.setProperty("--pos", position);
    return node;
}
// The ability list belongs to the secondary Pokémon, so it is rebuilt (and reset to the first
// ability) only when the secondary Pokémon changes, not on every re-render.
let abilityListFor = -1;
let abilityList = [];
function syncAbilityOptions(secondary) {
    if (abilityListFor === secondaryBox.index)
        return;
    abilityListFor = secondaryBox.index;
    abilityList = abilityChoices(secondary);
    abilitySelect.replaceChildren(...abilityList.map((choice, i) => {
        const option = h("option", undefined, choice.label);
        option.value = String(i);
        return option;
    }));
    abilitySelect.selectedIndex = 0; // explicit, so the reset is the same in every browser and in jsdom
    abilitySelect.disabled = abilityList.length === 0;
}
/** Shows the species items that fit the picked pair (either Pokémon can unlock one) and clears the rest. */
function syncSpeciesItems(primary, secondary) {
    const shown = new Set(speciesItemsFor(primary, secondary).map(item => item.id));
    for (const [id, { row, box }] of speciesItemRows) {
        row.hidden = !shown.has(id);
        if (row.hidden)
            box.checked = false; // a hidden item must not stay ticked
    }
    speciesItemsBox.hidden = shown.size === 0;
}
function render() {
    const primary = dex[primaryBox.index];
    const secondary = dex[secondaryBox.index];
    if (!primary || !secondary)
        return;
    syncAbilityOptions(secondary);
    syncSpeciesItems(primary, secondary);
    const f = fuse(primary, secondary);
    const fusedName = fusedSpeciesName(primary.fusionName, secondary.fusionName);
    const level = clampLevel(Number(levelInput.value));
    const ivs = ivInputs.map(input => clampIv(Number(input.value)));
    const held = heldItemInputs.map(({ input, max }) => clampCount(Number(input.value), max));
    const [soulDew = 0, machoBrace = 0] = held;
    // The permanent stat: base stats, level, IV, nature, vitamins, Soul Dew and Macho Brace.
    const atLevel = f.stats.map((v, i) => statAtLevel(i, v, level, ivs[i] ?? 0, natureMultiplier(NATURES[natureBox.index], i), {
        vitamin: held[2 + i], machoBrace, soulDew,
    }));
    // Eviolite and species items change the stat only in battle, so they are worked out on top of it.
    const optional = {
        eviolite: evioliteBox.checked,
        species: [...speciesItemRows].filter(([, { box }]) => box.checked).map(([id]) => id),
    };
    const inBattle = atLevel.map((v, i) => battleStat(v, battleMultiplier(i, primary, secondary, optional)));
    const boosted = inBattle.some((v, i) => v !== atLevel[i]);
    const rows = STAT_NAMES.map((name, i) => {
        const p = primary.stats[i] ?? 0, s = secondary.stats[i] ?? 0, v = f.stats[i] ?? 0;
        const fill = h("div", "fill");
        fill.style.setProperty("--pos", pct(v));
        const track = h("div", "track");
        track.append(fill, marker("tick p", `${primary.name}: ${p}`, pct(p)), marker("tick s", `${secondary.name}: ${s}`, pct(s)));
        const row = h("div", "stat");
        const value = h("span", "lvl", fmt(atLevel[i] ?? 0));
        if (inBattle[i] !== atLevel[i]) {
            const battle = h("span", "battle", `\u2192 ${fmt(inBattle[i] ?? 0)}`);
            battle.title = "Value in battle with Eviolite or a species item";
            value.append(battle);
        }
        row.append(h("span", undefined, name), track, value);
        return row;
    });
    const types = h("div", "types");
    for (const t of f.types) {
        const chip = h("span", "type", t);
        chip.style.background = COLORS[t];
        types.append(chip);
    }
    // A fused Pokémon takes its ability from its secondary Pokémon (the one the user picked above)...
    const chosenAbility = abilityList[Number(abilitySelect.value)] ?? abilityList[0];
    const abilityLine = h("div", "ability");
    abilityLine.append(h("b", undefined, "Ability: "), chosenAbility?.label ?? "None");
    // ...and the passive of its primary (first) Pokémon, once that passive is unlocked.
    const passiveLine = h("div", "passive");
    passiveLine.append(h("b", undefined, "Passive: "), primary.passive);
    const abilities = h("div", "abilities");
    abilities.append(abilityLine, ...(passiveToggle.checked ? [passiveLine] : []));
    const labels = h("div", "stat labels");
    labels.append(h("span"), h("span"), h("span", "lvl", `Lv ${fmt(level)}`));
    const legend = h("div", "legend");
    legend.append("Markers show the ", h("b", undefined, "primary"), " and ", h("b", undefined, "secondary"), " values.");
    if (boosted)
        legend.append(" An arrow shows the in-battle value with Eviolite or a species item.");
    const totalAtLevel = atLevel.reduce((x, y) => x + y, 0);
    const totalInBattle = inBattle.reduce((x, y) => x + y, 0);
    const total = `Total at Lv ${fmt(level)}: ${fmt(totalAtLevel)}${boosted ? ` (${fmt(totalInBattle)} in battle)` : ""}`;
    // Everything below is set with textContent, so Pokémon names are never parsed as HTML.
    result.replaceChildren(h("h2", undefined, fusedName), h("div", "parents", `${primary.name} + ${secondary.name}`), types, abilities, labels, ...rows, h("div", "total", total), legend);
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
    const dexChoices = dex.map(p => ({ label: p.name, text: normalize(`${p.name} ${p.types.join(" ")}`) }));
    primaryBox.setChoices(dexChoices, Math.max(0, dex.findIndex(p => p.name === "Charizard")));
    secondaryBox.setChoices(dexChoices, Math.max(0, dex.findIndex(p => p.name === "Garchomp")));
    for (const input of ivInputs) {
        input.oninput = render;
        input.onchange = () => {
            input.value = String(clampIv(Number(input.value)));
            render();
        };
    }
    levelInput.oninput = render;
    levelInput.onchange = () => {
        levelInput.value = String(clampLevel(Number(levelInput.value)));
        render();
    };
    el("swap").onclick = () => {
        const [a, b] = [primaryBox.index, secondaryBox.index];
        if (a < 0 || b < 0)
            return;
        primaryBox.setIndex(b);
        secondaryBox.setIndex(a);
        render();
    };
    render();
}
// Attach key blocking immediately, even if the data file fails to load.
for (const input of [levelInput, ...ivInputs])
    restrictToDigits(input);
for (const { input, max } of heldItemInputs) {
    restrictToDigits(input);
    input.oninput = render;
    input.onchange = () => {
        input.value = String(clampCount(Number(input.value), max));
        render();
    };
}
evioliteBox.addEventListener("change", render);
for (const { box } of speciesItemRows.values())
    box.addEventListener("change", render);
passiveToggle.addEventListener("change", render);
abilitySelect.addEventListener("change", render);
natureBox.setChoices(natureChoices, 0);
void init();
