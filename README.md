# poke-team-builder

Pokémon Team Coverage Analyzer — a React + Vite + TypeScript Progressive Web App
that helps build Pokémon teams and analyse type coverage, with support for
custom Pokémon (useful for ROM hacks).

## Stack

- React 18 + TypeScript
- Vite + `vite-plugin-pwa`
- Tailwind CSS (dark theme)
- PokéAPI (cached in `localStorage`, offline-capable)
- No backend — persistence is `localStorage` only

## Scripts

```bash
npm install
npm run dev        # local development server
npm run build      # production build
npm run preview    # preview production build
```

## GitHub Pages deployment

The Vite base path is read from `VITE_BASE_URL` (defaults to `/`). The included
workflow at `.github/workflows/deploy.yml` builds the app with the repository
name as the base and publishes the `dist/` folder via GitHub Pages on every push
to `main`. A `.nojekyll` file is included so assets in subfolders are served.

## Features

- Team builder with unlimited saved teams, six slots each
- Searchable Pokémon picker (all species + alternate forms)
- Editable types per slot (overrides do not change cached data)
- Four move slots per Pokémon, either picked from PokéAPI or fully custom
- Save Pokémon to a personal custom roster (renameable, deletable)
- Coverage analysis: per-Pokémon offensive grid, defensive profiles,
  shared weaknesses, uncovered types
- Smart team suggestions:
  - additions when the team is < 6
  - replacements for the weakest-link member when the team is full
  - filters to final evolutions, hides legendaries/mythicals
    unless one is already in the team
  - optionally includes the custom roster
- Showdown-format import/export (clipboard or `.txt`)
- PWA: installable, offline-capable, manual install prompt
- Settings: reset PokéAPI data cache

## Project layout

```
src/
  components/
    TeamBuilder/        PokemonSlot/   MoveSlot/
    SearchableDropdown/ TypeBadge/     CoverageGrid/
    SuggestionPanel/    ImportExport/  CustomRoster/  Settings/
  hooks/
    usePokemonData.ts   useTypeChart.ts
    useCoverageAnalysis.ts  useSuggestions.ts
  types/index.ts
  utils/
    coverageEngine.ts   showdownParser.ts
  App.tsx
  main.tsx
```