/*
 * Fused Pokémon name generation.
 *
 * This is a port of getFusedSpeciesName() from PokeRogue:
 *   https://github.com/pagefaultgames/pokerogue/blob/f664cfb732b3b8e01ff3d5fd2c906d07cf03fb47/src/utils/pokemon-utils.ts#L45-L117
 *   (permalink to commit f664cfb, the latest commit to touch that file; the function was
 *   identical on the main branch on 18 Oct 2026)
 * Original work copyright 2024-2026 Pagefault Games, licensed under the GNU AGPL-3.0-only. This file
 * is a derivative of that code, and the whole project is released under the AGPL-3.0-only too
 * (see LICENSE). The logic is deliberately kept identical, quirks
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
export function fusedSpeciesName(speciesAName: string, speciesBName: string): string {
  // The two patterns below are kept verbatim for parity with the game (see the permalink in the
  // header). Their character classes look odd: next
  // to a, e, i, o, u and y they also contain the literal characters ( ? : $ ) as well as - and '.
  // Those extra characters never matter for any name in the data today, but they are kept so that
  // results stay identical to the game's for any name it might add later. Do not "tidy" them.
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

  let fragA: string;
  let fragB: string;

  fragA = splitNameA.length === 1 ? (fragAMatch ? (fragAMatch[1] ?? speciesAName) : speciesAName) : splitNameA[splitNameA.length - 1] ?? "";

  if (splitNameB.length === 1) {
    if (fragBMatch) {
      const lastCharA = fragA.slice(fragA.length - 1);
      // Kept verbatim for parity with the game: it cuts by fragBMatch.length (the number of entries in the regex
      // result, which is always 3), not by the length of the matched text. Changing it to slice(-1)
      // alters about 3% of all fusion names, so tests pin examples (see tests/fusionName.test.ts).
      const prevCharB = (fragBMatch[1] ?? "").slice(fragBMatch.length - 1);
      fragB = (/[-']/.test(prevCharB) ? prevCharB : "") + fragBMatch[2] || prevCharB;
      if (lastCharA === fragB[0]) {
        if (/[aiu]/.test(lastCharA)) {
          fragB = fragB.slice(1);
        } else {
          const newCharMatch = new RegExp(`[^${lastCharA}]`).exec(fragB);
          if (newCharMatch?.index !== undefined && newCharMatch.index > 0) {
            fragB = fragB.slice(newCharMatch.index);
          }
        }
      }
    } else {
      fragB = speciesBName;
    }
  } else {
    fragB = splitNameB[splitNameB.length - 1] ?? "";
  }

  if (splitNameA.length > 1) {
    fragA = `${splitNameA.slice(0, splitNameA.length - 1).join(" ")} ${fragA}`;
  }

  fragB = `${fragB.slice(0, 1).toLowerCase()}${fragB.slice(1)}`;

  // Special case from the game: Rapidash would otherwise fuse into an awkward name, so it is extended to "Rapid"
  if (fragA === "Rapi") {
    fragA = "Rapid";
    if (fragB === "ng") {
      fragB = speciesBName.slice(speciesBName.length - 3);
    }
  }

  return `${speciesAPrefix || speciesBPrefix}${fragA}${fragB}${speciesBSuffix || speciesASuffix}`;
}
