import { abilityChoices } from "./abilities.js";
import { Combobox, normalize } from "./ui/combobox.js";
import { abilityStatNote, activeAbilities, hasHpIsOne } from "./abilityStats.js";
import { clampIv, clampLevel, fuse, statAtLevel } from "./fuse.js";
import { battleMultiplier, battleStat, clampCount, fusedItemLines, HELD_ITEM_LIMITS, mergeHeldItems, SPECIES_ITEMS, speciesItemsOf, } from "./heldItems.js";
import { fusedSpeciesName } from "./fusionName.js";
import { NATURES, natureLabel, natureMultiplier } from "./natures.js";
import { rankPartners } from "./partners.js";
import { decodeSetup, emptyItems, encodeSetup } from "./share.js";
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
const result = el("result");
function heldGroup(prefix) {
    const speciesBox = el(`${prefix}species-items`);
    // One checkbox per species-specific item, built once and shown only while this Pokémon can use it.
    const species = new Map();
    for (const item of SPECIES_ITEMS) {
        const box = h("input");
        box.type = "checkbox";
        box.id = `${prefix}item-${item.id}`;
        const text = h("span");
        text.append(h("b", undefined, item.name));
        const row = h("label", "chip");
        row.title = `${item.name} ${item.effect}`;
        row.hidden = true;
        row.append(box, text);
        species.set(item.id, { row, box });
        speciesBox.append(row);
    }
    return {
        soulDew: el(`${prefix}soul-dew`),
        machoBrace: el(`${prefix}macho-brace`),
        vitamins: STAT_NAMES.map((_, i) => el(`${prefix}vitamin${i}`)),
        sweetJuice: el(`${prefix}sweet-shuckle-juice`),
        foulJuice: el(`${prefix}foul-shuckle-juice`),
        oldGateau: el(`${prefix}old-gateau`),
        eviolite: el(`${prefix}eviolite`),
        speciesBox,
        species,
    };
}
const primaryItems = heldGroup("");
const secondaryItems = heldGroup("secondary-");
// The help list under the item boxes also describes each species item.
const helpList = el("item-help-list");
for (const item of SPECIES_ITEMS) {
    const line = h("li");
    line.append(h("b", undefined, item.name), ` ${item.effect}, only for ${item.species.join(", ")}.`);
    helpList.append(line);
}
/**
 * The primary Pokémon's IV for a stat, which is the most vitamins either Pokémon's box takes for it: the fused
 * Pokémon keeps the primary's IVs, and the secondary's own IVs are not asked for.
 */
const primaryIv = (stat) => clampIv(Number(ivInputs[stat]?.value));
/** Every number box of a group with its limit. Counts are kept to digits and clamped to the game's stack limits. */
function numberBoxes(group, vitaminLimit) {
    return [
        { input: group.soulDew, limit: () => HELD_ITEM_LIMITS.soulDew },
        { input: group.machoBrace, limit: () => HELD_ITEM_LIMITS.machoBrace },
        ...group.vitamins.map((input, i) => ({ input, limit: () => vitaminLimit(i) })),
    ];
}
const heldBoxes = [...numberBoxes(primaryItems, primaryIv), ...numberBoxes(secondaryItems, primaryIv)];
/** What a Pokémon holds according to its boxes, with every count held to its limit. */
function readHeld(group, vitaminLimit) {
    return {
        soulDew: clampCount(Number(group.soulDew.value), HELD_ITEM_LIMITS.soulDew),
        machoBrace: clampCount(Number(group.machoBrace.value), HELD_ITEM_LIMITS.machoBrace),
        vitamins: group.vitamins.map((input, i) => clampCount(Number(input.value), vitaminLimit(i))),
        sweetJuice: group.sweetJuice.checked,
        foulJuice: group.foulJuice.checked,
        oldGateau: group.oldGateau.checked,
        eviolite: group.eviolite.checked,
        species: [...group.species].filter(([, { box }]) => box.checked).map(([id]) => id),
    };
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
// A stat raised past the bar's scale (Old Gateau, Sweet Shuckle Juice) just fills the bar.
const pct = (v) => `${Math.min(100, (v / MAX_STAT) * 100)}%`;
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
/** Shows the species items this Pokémon can use itself and clears the rest. */
function syncSpeciesItems(group, pokemon) {
    const shown = new Set(speciesItemsOf(pokemon).map(item => item.id));
    for (const [id, { row, box }] of group.species) {
        row.hidden = !shown.has(id);
        if (row.hidden)
            box.checked = false; // a hidden item must not stay ticked
    }
    group.speciesBox.hidden = shown.size === 0;
}
/** Pulls both Pokémon's vitamin boxes down to the primary's IVs (after an IV is lowered or items are swapped in). */
function clampVitamins() {
    for (const group of [primaryItems, secondaryItems]) {
        group.vitamins.forEach((input, i) => {
            input.value = String(clampCount(Number(input.value), primaryIv(i)));
        });
    }
}
/** Moves each Pokémon's items to the other box set, so they stay with their Pokémon when the two are swapped. */
function swapHeldItems() {
    const swapValue = (a, b) => {
        [a.value, b.value] = [b.value, a.value];
    };
    const swapChecked = (a, b) => {
        [a.checked, b.checked] = [b.checked, a.checked];
    };
    swapValue(primaryItems.soulDew, secondaryItems.soulDew);
    swapValue(primaryItems.machoBrace, secondaryItems.machoBrace);
    primaryItems.vitamins.forEach((input, i) => {
        const other = secondaryItems.vitamins[i];
        if (other)
            swapValue(input, other);
    });
    swapChecked(primaryItems.sweetJuice, secondaryItems.sweetJuice);
    swapChecked(primaryItems.foulJuice, secondaryItems.foulJuice);
    swapChecked(primaryItems.oldGateau, secondaryItems.oldGateau);
    swapChecked(primaryItems.eviolite, secondaryItems.eviolite);
    for (const [id, { box }] of primaryItems.species) {
        const other = secondaryItems.species.get(id);
        if (other)
            swapChecked(box, other.box);
    }
    clampVitamins();
}
function render() {
    const primary = dex[primaryBox.index];
    const secondary = dex[secondaryBox.index];
    if (!primary || !secondary)
        return;
    syncAbilityOptions(secondary);
    syncSpeciesItems(primaryItems, primary);
    syncSpeciesItems(secondaryItems, secondary);
    const fusedName = fusedSpeciesName(primary.fusionName, secondary.fusionName);
    const level = clampLevel(Number(levelInput.value));
    const ivs = ivInputs.map(input => clampIv(Number(input.value)));
    // Vitamins are held to the primary's IV for that stat, in both boxes.
    for (const group of [primaryItems, secondaryItems]) {
        group.vitamins.forEach((input, i) => {
            input.max = String(ivs[i] ?? 0);
        });
    }
    const primaryHeld = readHeld(primaryItems, i => ivs[i] ?? 0);
    const secondaryHeld = readHeld(secondaryItems, i => ivs[i] ?? 0);
    // On fusion the game moves everything the secondary holds onto the primary, so that is what the stats use.
    const held = mergeHeldItems(primaryHeld, secondaryHeld, ivs);
    // Shuckle Juice and Old Gateau change the primary Pokémon's own base stats before the two are averaged.
    const f = fuse(primary, secondary, { sweetJuice: held.sweetJuice, foulJuice: held.foulJuice, oldGateau: held.oldGateau });
    // A fused Pokémon takes its ability from its secondary Pokémon (the one the user picked above) and its passive
    // from the primary Pokémon, once that passive is unlocked.
    const chosenAbility = abilityList[Number(abilitySelect.value)] ?? abilityList[0];
    const activeNames = activeAbilities(chosenAbility?.name, primary.passive, passiveToggle.checked);
    // The permanent stat: base stats, level, IV, nature, vitamins, Soul Dew and Macho Brace (and Wonder Guard's 1 HP).
    const atLevel = f.stats.map((v, i) => statAtLevel(i, v, level, ivs[i] ?? 0, natureMultiplier(NATURES[natureBox.index], i), {
        vitamin: held.vitamins[i], machoBrace: held.machoBrace, soulDew: held.soulDew, hpIsOne: hasHpIsOne(activeNames),
    }));
    // Eviolite, species items and abilities like Huge Power change the stat only in battle, so they are worked out on top of it.
    const optional = { eviolite: held.eviolite, species: held.species, abilities: activeNames };
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
            battle.title = "Value in battle with Eviolite, a species item or an ability like Huge Power";
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
    const abilityLine = h("div", "ability");
    abilityLine.append(h("b", undefined, "Ability: "), chosenAbility?.label ?? "None");
    const passiveLine = h("div", "passive");
    passiveLine.append(h("b", undefined, "Passive: "), primary.passive);
    // Abilities that change a stat on their own say so (and a passive that repeats the ability does not count twice).
    const noted = [
        [abilityLine, chosenAbility?.name],
        [passiveLine, primary.passive === chosenAbility?.name ? undefined : primary.passive],
    ];
    for (const [line, name] of noted) {
        const note = name !== undefined && activeNames.includes(name) ? abilityStatNote(name) : undefined;
        if (note)
            line.append(h("span", "ability-note", ` (${note})`));
    }
    const abilities = h("div", "abilities");
    abilities.append(abilityLine, ...(passiveToggle.checked ? [passiveLine] : []));
    // What the fused Pokémon holds once both Pokémon's items are combined.
    const heldLines = fusedItemLines(primaryHeld, secondaryHeld, held, ivs);
    const holding = h("div", "holding");
    holding.append(h("b", undefined, "Holds after fusing: "), heldLines.join("; "));
    const labels = h("div", "stat labels");
    labels.append(h("span"), h("span"), h("span", "lvl", `Lv ${fmt(level)}`));
    const legend = h("div", "legend");
    legend.append("Markers show the ", h("b", undefined, "primary"), " and ", h("b", undefined, "secondary"), " values.");
    if (boosted)
        legend.append(" An arrow shows the in-battle value with Eviolite, a species item or an ability like Huge Power.");
    const totalAtLevel = atLevel.reduce((x, y) => x + y, 0);
    const totalInBattle = inBattle.reduce((x, y) => x + y, 0);
    const total = `Total at Lv ${fmt(level)}: ${fmt(totalAtLevel)}${boosted ? ` (${fmt(totalInBattle)} in battle)` : ""}`;
    // Everything below is set with textContent, so Pokémon names are never parsed as HTML.
    result.replaceChildren(h("h2", undefined, fusedName), h("div", "parents", `${primary.name} + ${secondary.name}`), types, abilities, ...(heldLines.length > 0 ? [holding] : []), labels, ...rows, h("div", "total", total), legend);
    renderPartners(primary, level, ivs, held, natureBox.index);
    writeLink(primary, secondary);
}
const rankSel = el("rank-by");
const typeSel = el("rank-type");
const maxChk = el("rank-hidemax");
const megaChk = el("rank-hidemega");
const specialChk = el("rank-hidespecial");
const partnerBody = el("partner-body");
for (const t of Object.keys(COLORS))
    typeSel.append(new Option(t, t));
for (const c of [rankSel, typeSel, maxChk, megaChk, specialChk])
    c.addEventListener("change", () => render());
/** The partner whose button was just used, so focus can return to it after the list is redrawn. */
let refocusPartner;
function renderPartners(primary, level, ivs, held, nature) {
    const by = rankSel.value === "total" ? "total" : Number(rankSel.value);
    const top = rankPartners(primary, dex, {
        level, ivs, rankBy: by, hideMax: maxChk.checked, hideMega: megaChk.checked, hideSpecial: specialChk.checked, limit: 10,
        type: (typeSel.value || undefined),
        natureMultiplier: i => natureMultiplier(NATURES[nature], i),
        baseItems: { sweetJuice: held.sweetJuice, foulJuice: held.foulJuice, oldGateau: held.oldGateau },
        heldFor: i => ({ vitamin: held.vitamins[i], machoBrace: held.machoBrace, soulDew: held.soulDew }),
    });
    const table = h("table", "partners");
    const rankedBy = by === "total" ? "total" : STAT_NAMES[by] ?? "total";
    table.append(h("caption", "sr-only", `Best partners for ${primary.name}, ranked by ${rankedBy}. Choose a name to use it as the secondary.`));
    const head = h("tr");
    head.append(h("th", undefined, "#"), h("th", undefined, "Partner"), h("th", undefined, "Types"));
    STAT_NAMES.forEach((n, i) => head.append(h("th", by === i ? "hot" : undefined, n)));
    head.append(h("th", by === "total" ? "hot" : undefined, "Total"));
    Array.from(head.children).forEach(th => th.setAttribute("scope", "col"));
    table.append(head);
    const current = dex[secondaryBox.index];
    top.forEach((p, n) => {
        const tr = h("tr", "prow");
        // The name is a real button, so keyboards and screen readers can use it. Clicking anywhere else in the row works too.
        const choose = h("button", "pickbtn", p.secondary.name);
        choose.type = "button";
        choose.dataset.name = p.secondary.name;
        choose.setAttribute("aria-label", `Use ${p.secondary.name} as the secondary`);
        if (p.secondary === current)
            choose.setAttribute("aria-current", "true");
        tr.onclick = () => {
            refocusPartner = p.secondary.name;
            secondaryBox.setIndex(dex.indexOf(p.secondary));
            render();
        };
        const name = h("td", "pname");
        name.append(choose);
        const types = h("td", "ptypes");
        for (const t of p.types) {
            const c = h("span", "type", t);
            c.style.background = COLORS[t];
            types.append(c);
        }
        tr.append(h("td", undefined, String(n + 1)), name, types);
        p.stats.forEach((v, i) => tr.append(h("td", by === i ? "hot" : undefined, fmt(v))));
        tr.append(h("td", by === "total" ? "hot" : undefined, fmt(p.total)));
        table.append(tr);
    });
    partnerBody.replaceChildren(top.length ? table : h("p", undefined, "No partners match these filters."));
    // Picking a partner redraws the list, so keyboard focus goes back to the button that was used.
    if (refocusPartner !== undefined) {
        const name = refocusPartner;
        refocusPartner = undefined;
        Array.from(partnerBody.querySelectorAll("button.pickbtn")).find(b => b.dataset.name === name)?.focus();
    }
}
// ---- Shareable links: the current build lives in the page's query string ----
const copyButton = el("copy-link");
const shareNote = el("share-note");
/** True while a link is being loaded, so half-loaded states are not written back to the address bar. */
let applying = false;
function currentSetup(primary, secondary) {
    const ivs = ivInputs.map(input => clampIv(Number(input.value)));
    const choice = abilityList[Number(abilitySelect.value)];
    return {
        primary: primary.name,
        secondary: secondary.name,
        level: clampLevel(Number(levelInput.value)),
        nature: NATURES[natureBox.index]?.name ?? "",
        ivs,
        // The first ability is the default, so it is left out of the link.
        ability: choice && Number(abilitySelect.value) > 0 ? choice.name : "",
        passive: passiveToggle.checked,
        primaryItems: readHeld(primaryItems, i => ivs[i] ?? 0),
        secondaryItems: readHeld(secondaryItems, i => ivs[i] ?? 0),
    };
}
/** Keeps the address bar in step with the page, so its address can be copied at any time. */
function writeLink(primary, secondary) {
    if (applying)
        return;
    try {
        // The fragment stays, so a jump link (#partners) is not lost when a setting changes.
        history.replaceState(null, "", `${location.pathname}?${encodeSetup(currentSetup(primary, secondary))}${location.hash}`);
    }
    catch {
        // Some browsers refuse this (a file:// page, for example). The page still works without it.
    }
}
function setHeld(group, items) {
    group.soulDew.value = String(items.soulDew);
    group.machoBrace.value = String(items.machoBrace);
    group.vitamins.forEach((input, i) => {
        input.value = String(items.vitamins[i] ?? 0);
    });
    group.sweetJuice.checked = items.sweetJuice;
    group.foulJuice.checked = items.foulJuice;
    group.oldGateau.checked = items.oldGateau;
    group.eviolite.checked = items.eviolite;
}
/** Puts a link's setup into the page. Returns what the link asked for that this data does not have. */
function applySetup(setup) {
    const unused = [];
    applying = true;
    try {
        const find = (name, label, box, list) => {
            if (name === undefined)
                return;
            const index = list.findIndex(entry => entry.name.toLowerCase() === name.toLowerCase());
            if (index < 0)
                unused.push(`${label} "${name}"`);
            else
                box.setIndex(index);
        };
        find(setup.primary, "primary", primaryBox, dex);
        find(setup.secondary, "secondary", secondaryBox, dex);
        find(setup.nature, "nature", natureBox, NATURES);
        if (setup.level !== undefined)
            levelInput.value = String(setup.level);
        setup.ivs?.forEach((value, i) => {
            const input = ivInputs[i];
            if (input)
                input.value = String(value);
        });
        passiveToggle.checked = setup.passive ?? false;
        setHeld(primaryItems, setup.primaryItems ?? emptyItems());
        setHeld(secondaryItems, setup.secondaryItems ?? emptyItems());
        clampVitamins();
        // A first pass builds this secondary's ability list and shows the species items its Pokémon can use.
        render();
        abilitySelect.value = "0"; // a link without an ability means the first one, even when the secondary did not change
        if (setup.ability) {
            const index = abilityList.findIndex(choice => choice.name.toLowerCase() === setup.ability?.toLowerCase());
            if (index < 0)
                unused.push(`ability "${setup.ability}"`);
            else
                abilitySelect.value = String(index);
        }
        for (const [group, items, label] of [[primaryItems, setup.primaryItems, "primary"], [secondaryItems, setup.secondaryItems, "secondary"]]) {
            for (const id of items?.species ?? []) {
                const entry = group.species.get(id);
                if (entry && !entry.row.hidden)
                    entry.box.checked = true;
                else
                    unused.push(`${id} for the ${label} Pokémon`);
            }
        }
    }
    finally {
        applying = false;
    }
    render();
    return unused;
}
function showNote(text) {
    shareNote.textContent = text;
    shareNote.hidden = text === "";
}
/** Loads the build in the address bar, if it has one. */
function loadLink() {
    if (location.search.length <= 1)
        return;
    const unused = applySetup(decodeSetup(location.search));
    showNote(unused.length ? `Part of this link could not be used and was left at its default: ${unused.join(", ")}.` : "");
}
let copyTimer;
copyButton.addEventListener("click", async () => {
    // A shared link opens at the top of the page, so the jump fragment is left off.
    const link = location.href.split("#")[0] ?? location.href;
    let label = "Copied!";
    try {
        await navigator.clipboard.writeText(link);
        showNote("");
    }
    catch {
        // No clipboard access (an insecure page, or the browser said no): show the link to copy by hand.
        label = "Copy link";
        showNote(`Copy this link: ${link}`);
    }
    copyButton.textContent = label;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copyButton.textContent = "Copy link"; }, 2000);
});
window.addEventListener("popstate", loadLink);
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
            clampVitamins();
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
        swapHeldItems();
        render();
    };
    loadLink();
    render();
}
// Attach key blocking immediately, even if the data file fails to load.
for (const input of [levelInput, ...ivInputs])
    restrictToDigits(input);
for (const { input, limit } of heldBoxes) {
    restrictToDigits(input);
    input.oninput = render;
    input.onchange = () => {
        input.value = String(clampCount(Number(input.value), limit()));
        render();
    };
}
for (const group of [primaryItems, secondaryItems]) {
    for (const box of [group.sweetJuice, group.foulJuice, group.oldGateau, group.eviolite])
        box.addEventListener("change", render);
    for (const { box } of group.species.values())
        box.addEventListener("change", render);
}
passiveToggle.addEventListener("change", render);
abilitySelect.addEventListener("change", render);
natureBox.setChoices(natureChoices, 0);
void init();
