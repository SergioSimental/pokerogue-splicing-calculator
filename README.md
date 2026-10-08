# PokeRogue Splicing Calculator

A small TypeScript web app that previews the result of fusing (splicing) two Pokémon in PokeRogue: base stats, base stat total, and typing.

## Run locally
```bash
npm install
npm run build     # compiles src/ to dist/
npm run serve     # http://localhost:8000
```
Browsers block `fetch` on `file://`, so always use the local server. Use `npm run watch` while developing.

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
`data/pokemon.json` holds every species defined in PokeRogue's source (1,084), plus 235 alternate forms (Mega, G-Max, Primal, and others), for 1,319 entries in total. Regional variants such as Alolan and Galarian forms are separate species. It was extracted from `src/data/balance/species/generation-01.ts` through `generation-09.ts` in [pagefaultgames/pokerogue](https://github.com/pagefaultgames/pokerogue) (AGPL-3.0). Alternate forms are listed as `Species (Form)`, and forms with the same types and base stats as their base species (cosmetic ones like Unown letters or Vivillon patterns) are skipped.

```json
{ "name": "Garchomp", "stats": [108,130,95,80,85,102], "types": ["Dragon","Ground"] }
```
Stats are in order HP, Atk, Def, SpA, SpD, Spe. Display names are generated from the game's species IDs, so a few may differ slightly from in-game spelling.

## Roadmap
- Full Pokédex data (e.g. generated from PokeAPI)
- Ability pools and passives
- Search and filters, shareable links

## License
MIT. Pokémon and PokeRogue are property of their respective owners; this is an unofficial fan project.

## Structure
`src/types.ts` (types), `src/fuse.ts` (fusion rules), `src/main.ts` (UI), `data/pokemon.json` (dex).
