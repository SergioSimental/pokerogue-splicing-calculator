# PokeRogue Splicing Calculator

A small TypeScript web app that previews the result of fusing (splicing) two Pokémon in PokeRogue: the fused name, base stats, base stat total, and typing.

## Run locally
```bash
npm install
npm run build     # compiles src/ to dist/
npm run serve     # http://localhost:8000
```
Browsers block `fetch` on `file://`, so always use the local server. Use `npm run watch` while developing.

## Tests
```bash
npm test
```
Tests (Vitest) cover the fusion rules, level and IV math, natures, the shape of `data/pokemon.json`, the searchable dropdown's keyboard and mouse behavior, and that Pokémon names are always shown as plain text and never parsed as HTML. The UI tests run in a simulated browser (jsdom). They live in the `tests/` folder and are not part of the browser build. A GitHub Actions workflow (`.github/workflows/test.yml`) runs them on every push and also checks that the committed `dist/` matches `src/`.

## Deploy
The compiled `dist/` folder is committed, so no CI is needed. Run `npm run build` before pushing, then enable **Settings > Pages > Deploy from branch > main / root**.

## Fusion rules
Implemented in `fuse()` in `src/fuse.ts`:
- Each base stat = average of the primary and secondary Pokémon, rounded up.
- Primary type = primary Pokémon's primary type.
- Secondary type = secondary Pokémon's secondary type (or its primary type if it has none), skipping duplicates.

These rules are from memory of the game's behavior. Please verify against the current game and open an issue or PR if they differ.

## Levels
Level and IVs apply to the **primary** Pokémon only. The calculator first averages the two base stats (rounded up), then applies the primary Pokémon's IVs (0 to 31 per stat), level and nature. The level box accepts any whole number from 1 upward (there is no game-style cap; a ceiling of 1 trillion just keeps the math exact). Stats at that level use the standard formula with the IVs you enter (default 31):
- HP: `floor((2 * base + iv) * level / 100) + level + 10`
- Other stats: `floor(floor((2 * base + iv) * level / 100) + 5) * nature)`, where nature is 1.1 for the boosted stat, 0.9 for the lowered stat, and 1 otherwise. HP is never affected by nature.

The 25 natures and their order match PokeRogue's `src/data/nature.ts`.

## Data
`data/pokemon.json` holds every species defined in PokeRogue's source (1,084), plus 279 alternate forms (Mega, G-Max, Primal, Unown letters, and others), for 1,363 entries in total. Regional variants such as Alolan and Galarian forms are separate species. It was extracted from `src/data/balance/species/generation-01.ts` through `generation-09.ts` in [pagefaultgames/pokerogue](https://github.com/pagefaultgames/pokerogue) (AGPL-3.0). Alternate forms are listed as `Species (Form)`, and a form is skipped only when its types, base stats and passive are all identical to an earlier entry for the same species (for example Vivillon patterns).

```json
{ "name": "Garchomp", "fusionName": "Garchomp", "stats": [108,130,95,80,85,102], "types": ["Dragon","Ground"], "passive": "Arena Trap",
  "abilities": { "regular": ["Sand Veil"], "hidden": "Rough Skin" } }
```
`name` is the label shown in the dropdowns (for example "Alolan Raichu" or "Charizard (Mega X)"). `fusionName` is the name PokeRogue itself feeds into its fusion-name function for that species or form: the species name from the game's English locale file, wrapped as "Mega X", "G-Max X", "Primal X" or "E-Max X" for those forms. Regional forms use the plain species name there (Alolan Raichu is just "Raichu"), which is why it is stored separately. Stats are in order HP, Atk, Def, SpA, SpD, Spe. `passive` is the passive ability PokeRogue gives that species or form. `abilities.regular` lists its one or two regular abilities (an empty second slot is left out) and `abilities.hidden` its hidden ability, or `null` when it has none; for a few species the hidden ability repeats a regular one, as in the game's data. All ability names come from PokeRogue's English locale file ([pagefaultgames/pokerogue-locales](https://github.com/pagefaultgames/pokerogue-locales)). Display names are generated from the game's species IDs, so a few may differ slightly from in-game spelling.

## Fused name
The big heading on the results card is the fused Pokémon's name, made by `fusedSpeciesName()` in `src/fusionName.ts`. It is a port of PokeRogue's own `getFusedSpeciesName()`, kept identical (quirks included) so the names match the game's: roughly, the start of the primary Pokémon's name joined to the end of the secondary's, with special handling for prefixes like "Mega", suffixes like "X", hyphens, and a Rapidash case. The two names it uses are each entry's `fusionName`, so swapping the Pokémon changes the result. The port was checked against the game's function on every pair of names in the data (about 1.3 million) with no differences. Names are the English ones.

## Ability
A fused Pokémon takes its **ability** from its secondary (fused) Pokémon (in PokeRogue's source, a fusion uses the fusion species' ability slot). Pick it in the **Ability of the fused Pokémon** box under the pickers: it lists the secondary Pokémon's regular abilities and its hidden ability (marked "Hidden"; left out when it only repeats a regular ability). The chosen ability appears on the fused Pokémon's card. The list resets to the first ability whenever the secondary Pokémon changes.

## Passive ability
Tick **Passive ability unlocked** to show the passive of the fused Pokémon. In PokeRogue a fusion uses the passive of its primary (first) Pokémon, so the secondary Pokémon's passive is never shown. Passives are read from `data/pokemon.json`.

## Updating the data
`data/pokemon.json` is generated by `scripts/update-data.mjs`, which reads PokeRogue's source files and its English locale files (species names, form-name templates and ability names) and rewrites the JSON. The script needs internet access (it downloads these files from GitHub; set `POKEROGUE_LOCALE_REF` to read the locale files from a different branch or tag). The species-name and form-name files are required: if either cannot be read, the script stops and leaves the data untouched, because a guessed fusion name would be wrong.

```bash
npm run update-data                      # reads the upstream main branch
POKEROGUE_REF=<branch|tag|sha> npm run update-data   # reads a specific ref (PowerShell: $env:POKEROGUE_REF="beta"; npm run update-data)
```

It prints how many species were added, removed or changed. If anything looks wrong (for example the upstream file layout changes), it stops and leaves `data/pokemon.json` untouched.

A GitHub Actions workflow (`.github/workflows/update-data.yml`) runs the same script every Monday and commits the result if the data changed. You can also run it any time from the repo's **Actions** tab by choosing "Update PokeRogue data" and clicking **Run workflow**.

## Roadmap
- Full Pokédex data (e.g. generated from PokeAPI)
- Search and filters, shareable links

## License
Copyright (c) 2026 SergioSimental. Includes code from PokeRogue, copyright 2024-2026 Pagefault Games (AGPL-3.0-only). Licensed under the [GNU Affero General Public License, version 3](LICENSE) (AGPL-3.0-only). The project includes a port of code from PokeRogue (`src/fusionName.ts`), which is itself AGPL-3.0 licensed, so the whole project is released under the same licence. If you run a modified version of this site for other people, the AGPL requires you to offer them its source code; the page links to this repository for that reason. Earlier versions of this project (before the licence changed) were released under the MIT licence, and copies of those remain under it.

PokeRogue's data files are read at update time and attributed above. Pokémon and PokeRogue are property of their respective owners; this is an unofficial fan project.

## Structure
`src/types.ts` (types), `src/fuse.ts` (fusion rules), `src/natures.ts` (natures), `src/abilities.ts` (which abilities a fusion can take), `src/fusionName.ts` (fused name rule, ported from PokeRogue), `src/ui/combobox.ts` (searchable dropdown), `src/main.ts` (UI), `tests/` (tests), `data/pokemon.json` (dex), `scripts/update-data.mjs` (data generator), `scripts/abilities-parser.mjs` (reads abilities from PokeRogue's source), `scripts/form-names.mjs` (works out each entry's `fusionName`).
