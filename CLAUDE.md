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

1. **App boot.** `usePokemonData` checks `localStorage` for the cache
   under `teamdex_pokeapi_cache`. If missing or its `version` does not
   match `CACHE_VERSION`, the hook fetches Pokémon, species, evolution
   chains, types, and the move index from the static
   `raw.githubusercontent.com/PokeAPI/api-data` mirror (batched 50 at
   a time, 50 ms between batches, one retry per resource). On completion
   it writes the cache with `version: 2`. `teamdex_userdata` is never
   touched during this process. UI renders only after the cache is
   complete.
2. **Pokémon selection.** When the user picks a species in a slot, the
   slot reads the form's types from the cache, and pre-populates the
   ability field from `PokemonEntry.defaultAbility`. The user can
   override either type or the ability on that slot without affecting
   the cache.
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

Owns all static data fetching from the PokeAPI/api-data mirror on
GitHub (`raw.githubusercontent.com/PokeAPI/api-data`) and
`localStorage` caching for species, forms, the move index, types, and
evolution chains under `teamdex_pokeapi_cache`. Must **never** touch
`teamdex_userdata`. Must **not** contain coverage logic, suggestion
logic, or UI-only state. Invariants: the cache is either complete and
versioned (`{ version: CACHE_VERSION, data: { … } }`) or fully absent —
never partial. Move details are loaded lazily via `loadMoveDetails` and
written back into the same cache entry.

### `src/utils/spriteUtils.ts`

Owns all sprite URL resolution logic via `resolveSpriteUrl(pokemon,
context)`. Must **never** fetch images — only selects among the URL
strings stored on a `PokemonEntry`. Invariant: always returns `null`
rather than throwing when sprite data is missing or malformed.

### Sprite Resolution

- Sprites are never stored as binary data, only as URL strings on the
  `PokemonEntry` (`spriteHome`, `spriteArtwork`, `spriteDefault`).
- Card/slot context priority: HOME → official artwork → pixel sprite
  → `null` (caller renders the placeholder).
- Dropdown thumbnails always use the pixel sprite — HOME renders are
  too heavy for list items.
- Custom Pokémon saved to the roster never carry sprite URLs.
- Resolution is centralised in `src/utils/spriteUtils.ts`. Do **not**
  inline fallback logic in components.

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
of `TeamMember`. The `defensiveMultiplier` function accepts an
optional `ability?: string` parameter to apply ability-based
immunities and multipliers (from `abilityEffects.ts`).

### `src/data/typeSprites.ts`

Hardcoded mapping of `PokemonType` → PokeAPI numeric type ID, plus a
`getTypeSpriteUrl(type)` helper that returns the Scarlet/Violet small
sprite URL. Used by `TypeBadge` for all type display. Do **not** fetch
type IDs at runtime — they are stable constants.

### `src/data/abilityEffects.ts`

Typed map of ability slugs (lowercase, hyphenated, PokeAPI format) to
coverage-relevant effects. Three effect kinds:
- `immunity`: incoming attacks of that type deal 0 damage.
- `multiplier`: modifies the type chart result by a factor (defensive side).
- `badge-only`: UI-only indicator, no calculation change.

Do **not** add or remove entries from this map without discussion.
The map is consumed by `coverageEngine.ts` and by UI components for
ability badges.

`KNOWN_ABILITIES_WITH_EFFECTS` is an exported array of display-format
ability names (lowercase, space-separated) used as the canonical list
for the ability picker dropdown UI. It contains the same abilities
whose slugs are keys in `ABILITY_EFFECTS`.

### `src/hooks/teamGenerator.ts`

Pure team generation algorithm used by the "Surprise Me" feature.
Uses the same composite score formula as the suggestion engine
(gain − 0.5×new_weaknesses − 1.0×aggravated_shared_weaknesses) with
a ±0.01 random tie-breaking factor. Runs fully client-side.
Exports: `generateTeam`, `regenerateSlot`, `buildEligiblePool`,
`STARTER_FINALS`, `DEFAULT_CONSTRAINTS`.

**Anchor inclusion:** Anchor (locked) Pokémon are included in the
`currentTeam` from iteration step 0 of `generateTeam`. The composite
score for each candidate is computed against the full partial team
including anchors — never against an empty team. This ensures that
`aggravated_shared_weaknesses` correctly counts weaknesses already
present in the anchor set.

**Slot budget constraint:** The constraints step uses +/- counters
(no checkboxes). Each category (starters, legendaries/mythicals,
mega, dynamax, custom) has a numeric counter starting at 0. The
budget rule is: `anchorCount + sum(all counters) ≤ 6`, enforced by
disabling the `+` button when the budget is full. No clamping — the
`+` button simply becomes unavailable. Free slots (remainder after
anchors + counters) are filled by the algorithm using composite score
with no category filter.

**Legendaries and Mythicals — merged counter:** A single counter
`legendaryMythicalSlots` controls both legendary and mythical
Pokémon. The pool includes any entry where `isLegendary === true ||
isMythical === true`. The old separate `legendarySlots` and
`mythicalSlots` fields have been removed.

**"Exactly N" constraint semantics:** All constrained counters use
"exactly N" semantics. The algorithm:
1. Reserves N slots for each constrained category.
2. Fills reserved slots first by running the composite score only
   over the category sub-pool.
3. Fills remaining free slots from the unconstrained pool, excluding
   category members whose quota is already met.

Categories and their filters:
- **Starters:** `STARTER_FINALS` species set membership.
- **Legendaries / Mythicals:** `isLegendary === true || isMythical === true`.
- **Mega evolutions:** name includes `-mega`.
- **Dynamax/Gmax:** name includes `-gmax`.

**Data field audit (isLegendary / isMythical):** The fields in
`src/data/pokemon-data.json` are `isLegendary` (boolean) and
`isMythical` (boolean), matching the PokeAPI species endpoint's
`is_legendary` and `is_mythical` fields. Verified: Mewtwo has
`isLegendary: true`, Mew has `isMythical: true`, Articuno/Rayquaza
have `isLegendary: true`, and non-legendaries like Cinccino have
both set to `false`.

**Per-slot re-randomize:** `regenerateSlot` picks randomly among the
top 5 scoring candidates from a pool that excludes only the other 5
team members. Logs `console.error` and returns the existing member
unchanged when the candidate pool is empty.

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
- Ability line (`Ability: <name>`) — populated into `member.ability`.
- Move lines beginning with `- `; the move name is everything after
  `- ` until end-of-line.
- Type override comment of the form `# Types: type1[/type2]` (case
  insensitive, ignored if either type is not a valid `PokemonType`).

Lines matching `EVs:`, `IVs:`, or `Nature` are ignored.
Other `#` comment lines are ignored.

### Written on export

- Species name followed by `@ ` (empty item placeholder).
- `Ability: <ability>` line (ability value or empty if not set).
- `EVs: ` and ` Nature` placeholder lines.
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
  Optional parameters (like `ability`) are fine to add.
- The Showdown format contract above (`exportMemberToShowdown`,
  `parseShowdownBlock`). External users may rely on round-tripping.
- The PWA manifest icon paths (`public/icons/icon-192x192.png`,
  `public/icons/icon-512x512.png`, `public/favicon.ico`, `public/favicon.svg`) — they are referenced by
  the `vite-plugin-pwa` config in `vite.config.ts`.
- The `abilityEffects.ts` map entries. Do not add or remove abilities
  without updating tests and this documentation.
- The `STARTER_FINALS` list in `teamGenerator.ts`. Adding new
  generations requires updating this hardcoded list.
- The composite score weights (0.5 / 1.0) used in both suggestion
  and team generation engines.

## Common Pitfalls

- **Type badge display.** `TypeBadge` renders PokeAPI type sprites (small
  Scarlet/Violet icons) via `getTypeSpriteUrl()`. It no longer uses
  coloured pill text or abbreviations. Do **not** re-add `abbreviated`
  prop or inline colour classes.
- **Sprite URLs.** Always use `resolveSpriteUrl()` from
  `src/utils/spriteUtils.ts`; never access `spriteHome`,
  `spriteArtwork`, or `spriteDefault` directly from components.
- **Cache version.** If you add new fields to the cached payload
  structure, increment `CACHE_VERSION` in `usePokemonData.ts` —
  otherwise users with old caches will get runtime errors on missing
  fields.
- **Batch fetching.** Do not increase the batch size above 50 without
  testing. GitHub's CDN rate limits are undocumented and can cause
  silent failures at higher concurrency.
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
npm run generate-icons # generate PWA icons locally
```

### i18n

Uses i18next + react-i18next.
Translation files: src/i18n/locales/en.json and it.json.
All user-visible strings must use the useTranslation hook.
Pokémon names and move names are NOT translated.
Language persisted in localStorage key 'teamdex_lang'.

### PWA Icons

Icons are generated at build time by scripts/generate-icons.mjs
using the sharp package. They are gitignored and regenerated
on every deploy. Do not commit icon PNG files.
To regenerate locally: npm run generate-icons

### Searchable Dropdowns

All searchable dropdowns (Pokémon picker, move picker, anchor picker in
Surprise Me, ability picker) follow the same UX pattern:
- On focus/open, do **not** show any list items.
- Show placeholder "Start typing to search..." inside the input.
- Only show results once the user has typed at least 1 character.
- Show **all** matching results (no pagination, no item cap).
- Dropdown list is internally scrollable (min 240px, max 40vh when
  fixed-position mode is enabled).

### Analysis page structure

Seven sections in order: Coverage basis notice, Per-Pokémon
breakdown, Offensive grid, Defensive grid, Shared weaknesses,
Uncovered types, Suggestions.

### Suggestion scoring

Composite score = offensive_gain - 0.5×new_weaknesses
                  - 1.0×aggravated_shared_weaknesses
See suggestionEngine.ts for full implementation.
Do not change weights without updating this documentation
and the tests.

### Key unit tests

- `teamGenerator.test.ts` — "anchor composite score validation":
  Verifies that when anchor is Swampert (Water/Ground), the generated
  team does not contain more than 1 additional Water-type Pokémon in
  at least 4 out of 5 probabilistic runs. This ensures the composite
  score correctly penalizes redundant type coverage when anchors are
  present.
