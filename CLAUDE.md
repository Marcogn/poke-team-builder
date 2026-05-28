# CLAUDE.md

Instructions for AI coding agents (Claude Code, GitHub Copilot, etc.)
working in this repository. Read this file in full before editing any
code.

## Project Identity

The Pokémon Team Analyzer is a single-page PWA for building Pokémon
teams and analysing their type coverage offensively and defensively.
It supports custom Pokémon and per-slot type overrides, which makes it
useful for ROM hack runs and competitive draft building. It is **not**
a battle simulator, **not** a Pokémon Showdown replacement, and **not**
a damage calculator.

## Architecture Overview

- Single page React app. No router, no nested route state.
- All UI state lives in React. No Redux, no Zustand, no Recoil. The
  top-level `AppState` (`src/types/index.ts`) is persisted to
  `localStorage` and rehydrated on boot.
- PokéAPI data (Pokémon list, types, moves, evolution chain summaries)
  is fetched once on first load, cached in `localStorage`, and **never
  re-fetched** unless the user explicitly resets the cache from the
  Settings panel.
- No backend. No authentication. No telemetry. Network is used only for
  the initial PokéAPI fetch and for sprite URLs.

## Key Data Flows

1. **App boot.** `usePokemonData` checks `localStorage` for the cache.
   If absent, it fetches the Pokémon list, the type chart, the move
   list, and evolution chains from PokéAPI, writes them to
   `localStorage`, then resolves. UI renders only after the cache is
   complete.
2. **Pokémon selection.** When the user picks a species in a slot, the
   slot reads the form's types from the cache. The user can override
   either type on that slot without affecting the cache.
3. **Analyze.** The coverage hook calls pure functions in
   `coverageEngine.ts` to produce per-member offensive coverage, the
   team union, defensive profiles, and shared weaknesses. The
   suggestion hook then runs over the same data to produce ranked
   additions or replacements.
4. **Export.** `showdownParser.ts` serialises the active team to a
   Showdown-style multi-block string, copied to the clipboard or
   downloaded as a `.txt` file.
5. **Import.** `showdownParser.ts` parses a Showdown paste, resolves
   each block against the cache, and fills the team slots. Unknown
   moves are kept as placeholder custom moves and flagged so the UI
   can prompt the user to complete them.

## Module Responsibilities

### `src/hooks/usePokemonData.ts`

Owns all PokéAPI fetching and `localStorage` caching for species,
forms, moves, types, and evolution chains. Must **not** contain
coverage logic, suggestion logic, or UI-only state. Invariant: the
cache is either complete (all four datasets present and consistent)
or fully absent — never partial. The reset path clears the cache
atomically and triggers a fresh fetch.

### `src/hooks/useTypeChart.ts`

Thin selector that returns the cached type chart. Must **not** mutate
the chart. The chart is read-only at runtime; per-slot type overrides
live on `TeamMember`, never on the chart.

### `src/hooks/useCoverageAnalysis.ts`

Adapts `coverageEngine` to React: takes a team plus the chart and
returns memoised `{ team, defense, shared }`. Must **not** fetch data,
must **not** mutate inputs, must **not** include suggestion logic.
Returns `null` for an empty team rather than partial structures.

### `src/hooks/useSuggestions.ts`

Wraps the pure suggestion ranking logic and memoises results. Hosts
the policy switches (`includeCustoms`) but delegates ranking to a
pure function so it can be unit-tested without React. Must **not**
fetch data, must **not** mutate the team or roster.

### `src/utils/coverageEngine.ts`

Pure functions only. Owns the offensive coverage and defensive
multiplier math used everywhere else. Must **not** import React,
hooks, or anything from `src/hooks`. Invariant: every exported
function is referentially transparent given a `TypeChart` and a list
of `TeamMember`.

### `src/utils/showdownParser.ts`

Owns the Showdown format contract: serialisation (`exportMemberToShowdown`,
`exportTeamToShowdown`) and parsing (`parseShowdownBlock`,
`parseShowdownTeam`). Must **not** touch `localStorage`, must **not**
fetch from PokéAPI, must **not** depend on React. All species/move
resolution is injected via the `resolveMove` and `resolveTypes`
callbacks so the parser stays pure.

## Type Chart Rules

- The type chart is an 18×18 matrix keyed by attacker type then
  defender type, with values from `{0, 0.5, 1, 2}`.
- Dual-type defense **multiplies** the two effectiveness values (it
  never adds them). A 2× weakness on top of another 2× weakness becomes
  4×; a 2× weakness against a 0× immunity becomes 0×.
- Type overrides set on a `TeamMember` (used for ROM hack typings)
  apply only to that team slot. They must never be written back into
  the cached `TypeChart` or into the cached `PokemonEntry`.

## Suggestion Engine Rules

The algorithm in `useSuggestions.ts`:

1. Filter the cached pool to entries with `isFinalEvolution === true`
   (mid-evolutions are dropped). Append custom Pokémon when the
   `includeCustoms` flag is on.
2. For each candidate, compute its offensive coverage from its types
   only (never from saved moves).
3. **Team size < 6 (addition mode).** For each candidate, count the
   types it covers that the team does not yet cover; that is its
   `gain`. Return the top 5 by `gain`.
4. **Team size = 6 (replacement mode).** Compute each existing
   member's `unique_contribution` = types it covers that no other
   member covers. The member with the smallest unique contribution is
   the *weakest link*. Compute the team's base coverage without the
   weakest link; for every candidate, `gain(R) = |base ∪ candidate
   coverage| − |team coverage|`. Return the top 5 by `gain`, keyed by
   species name to avoid duplicates.
5. **Final-evolution preference.** Built into step 1: mid-evolutions
   are never offered.
6. **Legendary handling.** The current build does not exclude
   legendaries (all forms are kept in the pool). If you re-introduce
   exclusion, the rule must be: legendaries are excluded unless the
   active team already contains one.

### Move-awareness fallback

Per-member offensive coverage uses the member's moves when the member
has any damaging move entered (`memberHasMoves`). Otherwise it falls
back to the member's own types. Candidates in the suggestion engine
are always evaluated by types only — we never invent a movepool for
them.

## Showdown Format Contract

### Read on import

- Species name (first non-comment line, splits on `@`).
- Move lines beginning with `- `; the move name is everything after
  `- ` until end-of-line.
- Type override comment of the form `# Types: type1[/type2]` (case
  insensitive, ignored if either type is not a valid `PokemonType`).

Lines matching `Ability:`, `EVs:`, `IVs:`, or `Nature` are ignored.
Other `#` comment lines are ignored.

### Written on export

- Species name followed by `@ ` (empty item placeholder).
- `Ability: `, `EVs: `, and ` Nature` placeholder lines.
- One `- <move name>` line per non-null move slot.
- A trailing `# Types: ...` comment line preserving the slot's types.

### Unknown moves on import

If `resolveMove(name)` returns `null` for a move, the parser builds a
placeholder move with `isCustom: true`, `damageClass: 'status'`,
`power: null`, and the original name. The move name is appended to
the returned `unknownMoveNames` list so the caller can flag the slot
for manual completion. The block is still imported.

## What NOT to Change Without Discussion

- The `localStorage` cache schema. Breaking it requires a written
  migration plan and a version bump on the storage key.
- The `coverageEngine.ts` pure-function signatures. They are consumed
  by both the analysis hook and the suggestion engine and by tests.
- The Showdown format contract above (`exportMemberToShowdown`,
  `parseShowdownBlock`). External users may rely on round-tripping.
- The PWA manifest icon paths (`public/icon-192.png`,
  `public/icon-512.png`, `public/favicon.svg`) — they are referenced by
  the `vite-plugin-pwa` config in `vite.config.ts`.

## Common Pitfalls

- **Alternate forms.** Some Pokémon share a species but have different
  type arrays per form (Rotom, Deoxys, Wormadam, …). Always use the
  PokéAPI **form** endpoint, not the species endpoint, to read types.
- **Evolution chain timing.** The evolution chain fetch is a separate
  network round-trip from the Pokémon list. Do not assume evolution
  data is available before `usePokemonData` reports the cache as
  fully loaded.
- **Offensive type for moves.** When computing offense from moves,
  use the move's `type`, not the user Pokémon's types. Same-type
  attack bonus is not modelled.
- **Dual-type defense.** Effectiveness across two defender types is
  multiplicative, never additive. Watch for the immunity case where
  one type's 0× cancels the other type's 2×.

## Dev Commands

```bash
npm run dev            # local dev server
npm run build          # type-check then production build
npm run preview        # preview the production build locally
npm run test           # run the Vitest suite once
npm run test:coverage  # run the Vitest suite with coverage
```
