import { clampIv, clampLevel } from "./fuse.js";
import { clampCount, HELD_ITEM_LIMITS, SPECIES_ITEMS } from "./heldItems.js";
import { STAT_NAMES } from "./types.js";
export const defaultFilters = () => ({ rankBy: "total", type: "", hideMax: false, hideMega: false, hideSpecial: false });
const FORM_KEYS = ["max", "mega", "special"];
const MAX_TEXT = 80;
export const emptyItems = () => ({
    soulDew: 0, machoBrace: 0, vitamins: STAT_NAMES.map(() => 0),
    sweetJuice: false, foulJuice: false, oldGateau: false, eviolite: false, species: [],
});
/** One Pokémon's items as short tokens, like "sd3,mb50,v2-5,sweet,thick-club". Empty when it holds nothing. */
export function encodeItems(items) {
    const tokens = [];
    if (items.soulDew > 0)
        tokens.push(`sd${items.soulDew}`);
    if (items.machoBrace > 0)
        tokens.push(`mb${items.machoBrace}`);
    items.vitamins.forEach((count, i) => {
        if (count > 0)
            tokens.push(`v${i}-${count}`);
    });
    if (items.sweetJuice)
        tokens.push("sweet");
    if (items.foulJuice)
        tokens.push("foul");
    if (items.oldGateau)
        tokens.push("gateau");
    if (items.eviolite)
        tokens.push("eviolite");
    tokens.push(...items.species);
    return tokens.join(",");
}
/** Reads item tokens back. Unknown or malformed tokens are skipped, and every count is held to the game's limit. */
export function decodeItems(text) {
    const items = emptyItems();
    const speciesIds = new Set(SPECIES_ITEMS.map(item => item.id));
    for (const token of text.split(",")) {
        let m;
        if ((m = /^sd(\d{1,9})$/.exec(token)))
            items.soulDew = clampCount(Number(m[1]), HELD_ITEM_LIMITS.soulDew);
        else if ((m = /^mb(\d{1,9})$/.exec(token)))
            items.machoBrace = clampCount(Number(m[1]), HELD_ITEM_LIMITS.machoBrace);
        else if ((m = /^v([0-5])-(\d{1,9})$/.exec(token)))
            items.vitamins[Number(m[1])] = clampCount(Number(m[2]), HELD_ITEM_LIMITS.vitamin);
        else if (token === "sweet")
            items.sweetJuice = true;
        else if (token === "foul")
            items.foulJuice = true;
        else if (token === "gateau")
            items.oldGateau = true;
        else if (token === "eviolite")
            items.eviolite = true;
        else if (speciesIds.has(token) && !items.species.includes(token))
            items.species.push(token);
    }
    return items;
}
const enc = encodeURIComponent;
/** The link's query string (no leading "?") for a setup. Empty item sets and an unticked passive are left out. */
export function encodeSetup(setup) {
    const parts = [
        `p=${enc(setup.primary)}`,
        `s=${enc(setup.secondary)}`,
        `l=${setup.level}`,
        `n=${enc(setup.nature)}`,
        `iv=${setup.ivs.join(",")}`,
    ];
    if (setup.ability)
        parts.push(`ab=${enc(setup.ability)}`);
    if (setup.passive)
        parts.push("pp=1");
    const primary = encodeItems(setup.primaryItems);
    const secondary = encodeItems(setup.secondaryItems);
    if (primary)
        parts.push(`pi=${enc(primary).replace(/%2C/g, ",")}`);
    if (secondary)
        parts.push(`si=${enc(secondary).replace(/%2C/g, ",")}`);
    const f = setup.filters;
    if (f.rankBy !== "total")
        parts.push(`rb=${(STAT_NAMES[f.rankBy] ?? "").toLowerCase()}`);
    if (f.type)
        parts.push(`rt=${enc(f.type)}`);
    const hidden = FORM_KEYS.filter(key => (key === "max" ? f.hideMax : key === "mega" ? f.hideMega : f.hideSpecial));
    if (hidden.length)
        parts.push(`hf=${hidden.join(",")}`);
    return parts.join("&");
}
/** Reads a query string. Anything invalid is dropped, so a damaged or hand-edited link never breaks the page. */
export function decodeSetup(query) {
    const params = new URLSearchParams(query);
    const out = {};
    const text = (key) => {
        const value = params.get(key);
        return value ? value.slice(0, MAX_TEXT) : undefined;
    };
    const primary = text("p");
    if (primary)
        out.primary = primary;
    const secondary = text("s");
    if (secondary)
        out.secondary = secondary;
    const nature = text("n");
    if (nature)
        out.nature = nature;
    const ability = text("ab");
    if (ability)
        out.ability = ability;
    const level = params.get("l");
    if (level !== null && /^\d{1,13}$/.test(level))
        out.level = clampLevel(Number(level));
    const ivs = params.get("iv")?.split(",");
    if (ivs && ivs.length === STAT_NAMES.length && ivs.every(v => /^\d{1,9}$/.test(v)))
        out.ivs = ivs.map(v => clampIv(Number(v)));
    out.passive = params.get("pp") === "1";
    out.primaryItems = decodeItems(params.get("pi") ?? "");
    out.secondaryItems = decodeItems(params.get("si") ?? "");
    // Filters a link does not mention are put back to their defaults, like the passive.
    const filters = defaultFilters();
    const rank = STAT_NAMES.findIndex(name => name.toLowerCase() === params.get("rb")?.toLowerCase());
    if (rank >= 0)
        filters.rankBy = rank;
    filters.type = text("rt") ?? "";
    const hidden = (params.get("hf") ?? "").toLowerCase().split(",");
    filters.hideMax = hidden.includes("max");
    filters.hideMega = hidden.includes("mega");
    filters.hideSpecial = hidden.includes("special");
    out.filters = filters;
    return out;
}
