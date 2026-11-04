import { MAX_IV } from "./fuse.js";
/**
 * Most stacks of each held item, as PokeRogue allows them. The vitamin limit here is the highest
 * a Pokémon can ever have (31); in the game the real limit for each vitamin is that stat's IV.
 */
export const HELD_ITEM_LIMITS = {
    soulDew: 10,
    machoBrace: 50,
    vitamin: MAX_IV,
};
/** Keeps a typed stack count a whole number from 0 up to `max`. Anything unreadable becomes 0. */
export function clampCount(value, max) {
    if (!Number.isFinite(value))
        return 0;
    return Math.min(max, Math.max(0, Math.floor(value)));
}
/** The six species-specific items in PokeRogue, in the order they are shown. */
export const SPECIES_ITEMS = [
    { id: "deep-sea-tooth", name: "Deep Sea Tooth", effect: "doubles Sp. Atk", species: ["Clamperl"] },
    { id: "deep-sea-scale", name: "Deep Sea Scale", effect: "doubles Sp. Def", species: ["Clamperl"] },
    { id: "light-ball", name: "Light Ball", effect: "doubles Atk and Sp. Atk", species: ["Pikachu"] },
    { id: "thick-club", name: "Thick Club", effect: "doubles Atk", species: ["Cubone", "Marowak", "Alolan Marowak"] },
    { id: "metal-powder", name: "Metal Powder", effect: "doubles Def", species: ["Ditto"] },
    { id: "quick-powder", name: "Quick Powder", effect: "doubles Speed", species: ["Ditto"] },
];
/**
 * Whether a dex entry is one of the listed species. Forms count ("Pikachu (Cosplay)" is a Pikachu), but a
 * different species that merely contains the name does not, and "Marowak" does not cover "Alolan Marowak".
 */
export function matchesSpecies(entryName, species) {
    return species.some(label => entryName === label || entryName.startsWith(`${label} (`));
}
/**
 * The species items worth offering for this pair. PokeRogue applies one when the holder's own species OR its
 * fusion partner is on the item's list, so either picked Pokémon can unlock it.
 */
export function speciesItemsFor(primary, secondary) {
    return SPECIES_ITEMS.filter(item => matchesSpecies(primary.name, item.species) || matchesSpecies(secondary.name, item.species));
}
