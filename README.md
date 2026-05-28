# Pokémon Team Analyzer

A React + TypeScript Progressive Web App for assembling Pokémon teams and
analysing their offensive and defensive type coverage. It is built primarily
for ROM hack players and competitive builders who want fast iteration over
team composition without depending on a backend or an account system.

## Screenshots

<!-- add screenshots here -->

_Add screenshots of the team builder, coverage grid, and suggestion panel
in this section._

## Features

- Multiple saved teams with six slots each, persisted in `localStorage`.
- Searchable picker covering every PokéAPI species and alternate form.
- Per-slot type overrides for ROM hack typings; overrides never mutate the
  cached species data.
- Four move slots per Pokémon, picked from PokéAPI or entered as custom moves.
- Personal custom roster: any team member can be saved, renamed, deleted,
  and re-used across teams.
- Coverage analysis: per-member offensive grid, defensive profile
  (weak/resist/immune), shared team weaknesses, uncovered types.
- Smart suggestions: additions when the team has fewer than six members,
  weakest-link replacements when the team is full, optional inclusion of the
  custom roster, final-evolution preference, legendary handling.
- Showdown-format import and export through clipboard or `.txt` file.
- PWA install support: works offline once the PokéAPI cache is built.
- Settings panel to reset the PokéAPI data cache.

## Tech stack

- React 18 with TypeScript
- Vite as the build tool and dev server
- Tailwind CSS for styling (dark theme)
- `vite-plugin-pwa` for the manifest and service worker
- [PokéAPI](https://pokeapi.co) as the data source (cached in `localStorage`)

## Getting started

### Prerequisites

- Node.js **18.x or later** (Vite 5 requires Node 18+).
- npm 9 or later (bundled with Node 18).

### Install and run

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` by default.

### Environment variables

| Variable         | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `VITE_BASE_URL`  | Base path for the build, e.g. `/poke-team-builder/` for  |
|                  | GitHub Pages. Defaults to `/`.                           |

Set it in a `.env` file at the project root or inline at build time:

```bash
VITE_BASE_URL=/poke-team-builder/ npm run build
```

## First run behavior

On first launch the app has no PokéAPI data in `localStorage`. It will:

1. Fetch the full Pokémon list (species + forms), the type chart, and
   evolution chain summaries from PokéAPI.
2. Display a progress indicator while the cache is being built.
3. Persist the result in `localStorage` so that subsequent loads are
   instantaneous and work offline.

The cache is never refreshed automatically. Use **Settings → Reset PokéAPI
cache** to force a re-download (for example after a PokéAPI update).

## Installing as a PWA

### Desktop (Chrome, Edge, Brave)

1. Open the deployed site in the browser.
2. Click the install icon in the address bar (or use the menu →
   *Install Pokémon Team Analyzer*).
3. The app opens in its own window and works offline.

### iOS (Safari)

1. Open the site in Safari.
2. Tap the share icon, then *Add to Home Screen*.

### Android (Chrome)

1. Open the site in Chrome.
2. Tap the menu, then *Install app* / *Add to Home screen*.

## Showdown import / export format

The app reads and writes
[Pokémon Showdown](https://pokemonshowdown.com)-style team blocks separated
by blank lines.

### Fields the app actually tracks

- **Species name** (first line, optionally followed by `@ item`).
- **Types**, via the trailing `# Types: <type1>[/<type2>]` comment line.
  This is how type overrides for ROM hacks round-trip.
- **Moves**, written as lines beginning with `- `.

### Fields emitted as placeholders on export

The following Showdown fields are exported as empty placeholders so that
the output is still a valid Showdown paste, but the app does **not** track
their values:

- `Ability: `
- `EVs: `
- ` Nature`
- The item after `@` on the species line

On import these placeholder lines are ignored. If a move name is unknown
to the local PokéAPI cache it is imported as a custom placeholder move and
flagged so the user can complete it manually.

### Example exported member

```
Pikachu @ 
Ability: 
EVs: 
 Nature
- Thunderbolt
- Iron Tail
- Quick Attack
- Volt Tackle
# Types: electric
```

## Custom Pokémon

A Pokémon does not need to exist in PokéAPI to be used in a team.

1. In any slot, pick *Custom* (or edit the species name freely) and set
   its types and moves manually.
2. Click **Save to custom roster** on the slot. The Pokémon is added to
   your personal roster and persisted in `localStorage`.
3. From the picker, enable *Include custom roster* to reuse saved custom
   Pokémon in any team. They are also offered by the suggestion engine
   when the toggle is on.
4. Custom Pokémon can be renamed and deleted from the **Custom Roster**
   panel.

## GitHub Pages deployment

### GitHub Pages Setup (one-time)

1. Go to repo Settings → Pages → Source: Deploy from branch → `gh-pages`.
2. Go to repo Settings → Variables → Actions → New repository variable:
   Name: `REPO_NAME`, Value: your-repo-name (without slashes).
3. Push to `main` — the Actions workflow handles the rest.

### First Deploy Expected Behavior

- Actions runs: `test` → `build` → `deploy`.
- GitHub Pages may take 1-2 minutes to become live after the first deploy.
- PWA cache will populate on first browser visit (PokéAPI data fetch).

### Local Preview of Production Build

```bash
npm run build && npm run preview
```

### Manual deployment

```bash
VITE_BASE_URL=/<repo-name>/ npm run build
# upload the contents of dist/ to the gh-pages branch
```

The `public/.nojekyll` file is bundled so subdirectory assets are served
correctly.

## Known limitations

- The move-aware suggestion engine evaluates candidates by their own
  type chart only; it does not attempt to infer movepools for candidates.
- There is no backend. Teams, custom Pokémon and the PokéAPI cache live
  in `localStorage` and are scoped per browser.
- The PokéAPI cache is never refreshed automatically. Use the Settings
  panel to reset it.
- Suggestion depth is shallow (top 5 candidates); the engine does not
  perform deep search across multi-slot substitutions.

## Contributing

1. Fork the repository.
2. Create a feature branch (`feature/<name>`, `fix/<name>` or
   `docs/<name>`).
3. Run `npm run test` before opening a PR.
4. Open a pull request describing what changed, why, and which tests
   cover the change.

See [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) for the full
contributor guide.

## License

MIT
