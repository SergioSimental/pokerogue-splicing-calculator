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

## Data
`data/pokemon.json` holds a starter set of 25 Pokémon:

```json
{ "name": "Garchomp", "stats": [108,130,95,80,85,102], "types": ["Dragon","Ground"] }
```
Stats are in order HP, Atk, Def, SpA, SpD, Spe. Add more entries to extend the calculator.

## Roadmap
- Full Pokédex data (e.g. generated from PokeAPI)
- Ability pools and passives
- Search and filters, shareable links

## License
MIT. Pokémon and PokeRogue are property of their respective owners; this is an unofficial fan project.

## Structure
`src/types.ts` (types), `src/fuse.ts` (fusion rules), `src/main.ts` (UI), `data/pokemon.json` (dex).
