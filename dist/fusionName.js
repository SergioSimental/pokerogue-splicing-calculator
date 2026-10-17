/*
 * Fused Pokémon name generation.
 *
 * This is a port of getFusedSpeciesName() from PokeRogue (src/utils/pokemon-utils.ts in
 * https://github.com/pagefaultgames/pokerogue, main branch as of 16 Oct 2026). PokeRogue is
 * licensed under the GNU AGPL-3.0, and this file is a derivative of that code. The whole project is
 * released under the AGPL-3.0 too (see LICENSE). The logic is deliberately kept identical, quirks
 * included, so the names match the game's. Changes from the original are limited to what this
 * project's stricter TypeScript settings require (guards on array reads); behaviour is unchanged.
 *
 * Inputs are the names the game passes in: for each Pokémon, species.getName(formIndex), which is
 * the English species name, wrapped as "Mega X", "G-Max X", "Primal X" or "E-Max X" for those forms.
 * The data file stores that as each entry's `fusionName`.
 *
 * @param speciesAName - the primary (first) Pokémon's name; supplies the start of the result
 * @param speciesBName - the secondary (fused) Pokémon's name; supplies the end of the result
 */
export function fusedSpeciesName(speciesAName, speciesBName) {
    const fragAPattern = /([a-z]{2}.*?[aeiou(?:y$)\-']+)(.*?)$/i;
    const fragBPattern = /([a-z]{2}.*?[aeiou(?:y$)\-'])(.*?)$/i;
    const [speciesAPrefixMatch, speciesBPrefixMatch] = [speciesAName, speciesBName].map(n => /^(?:[^ ]+) /.exec(n));
    const [speciesAPrefix = "", speciesBPrefix = ""] = [speciesAPrefixMatch, speciesBPrefixMatch].map(m => m?.[0] ?? "");
    if (speciesAPrefix) {
        speciesAName = speciesAName.slice(speciesAPrefix.length);
    }
    if (speciesBPrefix) {
        speciesBName = speciesBName.slice(speciesBPrefix.length);
    }
    const [speciesASuffixMatch, speciesBSuffixMatch] = [speciesAName, speciesBName].map(n => / (?:[^ ]+)$/.exec(n));
    const [speciesASuffix = "", speciesBSuffix = ""] = [speciesASuffixMatch, speciesBSuffixMatch].map(m => m?.[0] ?? "");
    if (speciesASuffix) {
        speciesAName = speciesAName.slice(0, -speciesASuffix.length);
    }
    if (speciesBSuffix) {
        speciesBName = speciesBName.slice(0, -speciesBSuffix.length);
    }
    const splitNameA = speciesAName.split(/ /g);
    const splitNameB = speciesBName.split(/ /g);
    const fragAMatch = fragAPattern.exec(speciesAName);
    const fragBMatch = fragBPattern.exec(speciesBName);
    let fragA;
    let fragB;
    fragA = splitNameA.length === 1 ? (fragAMatch ? (fragAMatch[1] ?? speciesAName) : speciesAName) : splitNameA[splitNameA.length - 1] ?? "";
    if (splitNameB.length === 1) {
        if (fragBMatch) {
            const lastCharA = fragA.slice(fragA.length - 1);
            const prevCharB = (fragBMatch[1] ?? "").slice(fragBMatch.length - 1) /* sic: upstream slices by the match array's length */;
            fragB = (/[-']/.test(prevCharB) ? prevCharB : "") + fragBMatch[2] || prevCharB;
            if (lastCharA === fragB[0]) {
                if (/[aiu]/.test(lastCharA)) {
                    fragB = fragB.slice(1);
                }
                else {
                    const newCharMatch = new RegExp(`[^${lastCharA}]`).exec(fragB);
                    if (newCharMatch?.index !== undefined && newCharMatch.index > 0) {
                        fragB = fragB.slice(newCharMatch.index);
                    }
                }
            }
        }
        else {
            fragB = speciesBName;
        }
    }
    else {
        fragB = splitNameB[splitNameB.length - 1] ?? "";
    }
    if (splitNameA.length > 1) {
        fragA = `${splitNameA.slice(0, splitNameA.length - 1).join(" ")} ${fragA}`;
    }
    fragB = `${fragB.slice(0, 1).toLowerCase()}${fragB.slice(1)}`;
    // Prevents some unfortunate fusion names from Rapidash + X
    if (fragA === "Rapi") {
        fragA = "Rapid";
        if (fragB === "ng") {
            fragB = speciesBName.slice(speciesBName.length - 3);
        }
    }
    return `${speciesAPrefix || speciesBPrefix}${fragA}${fragB}${speciesBSuffix || speciesASuffix}`;
}
