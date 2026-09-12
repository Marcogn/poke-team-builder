# Project Status

A snapshot of what's implemented, what's known to be missing, and any loose
ends — written for whoever (human or agent) picks this project up next.
Last verified 2026-09-12, after release `2.0.1`, the post-2.0.1
Showdown import fix, and the launcher icon replacement — the native rewrite described in
[`docs/plan/README.md`](plan/README.md) and its Phase 7 follow-up are both
complete and shipped. Re-verify anything here
before relying on it — this file goes
stale the moment someone ships a change without updating it. It complements,
not replaces, the other docs: [`CLAUDE.md`](../CLAUDE.md) for rules and
invariants, [`docs/plan/README.md`](plan/README.md) for the phase-by-phase
build, [`docs/plan/native-spec.md`](plan/native-spec.md) for what the
finished app must do, [`ROADMAP.md`](../ROADMAP.md) for the deliberately
out-of-scope backlog, and [`docs/next-steps.md`](next-steps.md) for the
concise, cited list of remaining known work.

## What CoverDex is right now

A native Android app that downloads and caches the full Pokémon catalogue in
the background, lets the user build real teams (create/rename/delete a team,
fill its six slots from the synced catalogue or type a ROM-hack-only
species/ability/move by hand, override a slot's types, save any slot into a
reusable custom roster), analyses those teams (every team's Analysis tab
shows the ported coverage engine's full output — basis notice, per-Pokémon
breakdown, offensive/defensive grids, shared weaknesses, uncovered types),
and now suggests how to improve them: the Analysis tab's seventh section
ranks real candidates to add or swap in, filterable by generation and
custom-Pokémon inclusion, and a new Surprise Me screen generates a whole
team from scratch around optional locked anchors and category constraints.
Teams round-trip through Pokémon Showdown's team format (export from a
team's overflow menu, import from Settings into a brand-new team), every
setting from the old web app is now present, and Settings has a local
backup that exports/restores every team and the custom roster to a single
file. Since Phase 7, abilities and moves show their real names (not raw
PokéAPI slugs), the ability field offers a species' canonical abilities
with a free-text custom fallback, held items affecting type coverage can
be assigned and round-trip through Showdown/backup, base stats feed a
tie-break in the suggestion ranking so a solid team's alternatives lead
with strong Pokémon instead of the lowest catalogue id, the number of
suggestions shown is configurable, and ten previously-unmodelled
abilities (plus an offensive gap) now affect the coverage calculation.
That is the full feature set of `docs/plan/native-spec.md` plus Phase 7's
accuracy/customization work; the native rewrite in
[`docs/plan/README.md`](plan/README.md) is complete.
The real release keystore was generated and the GitHub secrets set by the
repository owner (that part was never an agent's to do — see
[`docs/release-signing.md`](release-signing.md)), and the `Release`
workflow has since shipped `2.0.0` (2026-09-04) and `2.0.1` (2026-09-06) —
see `CHANGELOG.md` and `app/build.gradle.kts` (`versionCode = 3`,
`versionName = "2.0.1"`). `2.0.1` fixed a Surprise Me crash, a broken
"Custom slots" constraint, coverage/generation running on the main thread,
a missing "coverage is already solid" note, and a scoring/ability
mismatch between the Analysis grid and Suggestions — see
`docs/post-migration-review.md` for all six audited findings. Since then,
an additional real bug was found and fixed (2026-09-12, not yet cut into a
release): Showdown import corrupted the species on any real-world set
carrying a `Level:`/`Tera Type:`/`Shiny:`-style line, because the parser
treated any unrecognized line as a fresh species line — see
`CHANGELOG.md`'s `[Unreleased]` section and
`docs/implementation-decisions.md`, "Showdown format compatibility".

## What's implemented

- **Everything from Phase 1** — the dataset sync, the Room v1 cache, the
  Settings → Data section, the non-blocking sync banner. See git history;
  not repeated here.
- **Room schema v2** (`team`, `team_member`, `team_member_move`,
  `custom_pokemon`, `custom_pokemon_move`), reached from v1 by a hand-written
  `MIGRATION_1_2`, verified byte-for-byte against Room's own exported schema
  and exercised by `Migration1To2Test` (Robolectric + `MigrationTestHelper`).
  Getting that test running at all surfaced a real AGP/Robolectric gap — see
  `docs/implementation-decisions.md`, "Phase 2".
- **`TeamRepository` and `CustomPokemonRepository`**, both transactional,
  both built on `Team`/`TeamMember`/`PokemonMove` domain models that mirror
  `legacy-web`'s fixed-size nullable-slot shapes exactly (`Team.members`:
  length 6; `TeamMember.moves`: length 4). Species/type/ability/move data on
  every slot is a denormalized snapshot — wiping the Pokédex cache never
  touches a saved team or roster entry (asserted directly in
  `TeamRepositoryTest`).
- **The Teams screen** — real CRUD: create (a name dialog), rename, delete
  (a confirmation dialog), tap to open. A new team opens immediately after
  creation.
- **The team detail screen** — two tabs (Pokémon / Analysis, the latter a
  placeholder), a six-slot grid, and the persisted, app-wide "Enable move
  slots" toggle.
- **The slot editor** — a real navigation destination (not a dialog): a
  species picker (`SearchableDropdown`, backed by `PokedexRepository`), two
  type-override dropdowns, a free-text ability field
  (`EditableComboBox`, ported from Hall of Memories — a materially
  different contract from `SearchableDropdown`, see
  `docs/implementation-decisions.md`), four move slots (each accepting a
  cached move or a typed custom one, defaulting to Normal/Physical per the
  verified `legacy-web` behaviour), "Save as custom" and "Clear slot".
  Nothing is written until an explicit Save; back (system gesture or the
  top bar) always discards the in-progress draft.
- **The custom roster** — its own screen (list, create, edit, delete) and
  its own editor, "the same editor as a slot, minus the species picker."
- **`PokemonType.displayName()`/`DamageClass.displayName()`** — the first
  time either enum renders as text rather than a sprite; all 18 type names
  and the three damage-category names were checked individually against
  Bulbapedia rather than assumed.
- **`DebugSeeder`** now seeds two teams (one partial, one full six) and two
  custom roster entries behind `BuildConfig.SEED_DEBUG_DATA`, wired from
  `CoverDexApplication.onCreate`; a no-op once any real team exists, so it
  never re-seeds over real user data or duplicates itself on relaunch.
- **The coverage engine** (`domain/coverage/CoverageEngine.kt`) and ability
  effects (`domain/ability/AbilityEffects.kt`) — direct ports of
  `coverageEngine.ts`/`abilityEffects.ts`, same function names and
  signatures, `CoverageEngineTest` porting all 36 of the TypeScript
  oracle's cases with the same expected values.
- **The Analysis tab** — all seven sections from
  `phase-3-analysis.md` §2, in order: the coverage basis notice
  (moves/types/mixed, matching `TeamDetailPage.tsx`'s exact wording),
  per-Pokémon breakdown (expandable cards), the offensive and defensive
  18-type grids (pinned name column, independently horizontally
  scrolling, `CoverageGridTable` shared between both), shared weaknesses
  with counts, uncovered types, and — as of Phase 4 — real suggestions.
  `AnalysisViewModel` applies the "Enable move slots" gate before the
  engine ever sees a member's moves.
- **The suggestion engine** (`domain/suggestion/`) — a direct port of
  `suggestionEngine.ts`'s `computeSuggestions`/`memberFromEntry`, with the
  composite-score weights shared with the generator via `Scoring.kt`. One
  intentional deviation from the TypeScript: the generation filter uses
  each candidate's real `generationIntroduced` instead of hardcoded
  Pokédex-id ranges (`docs/plan/reference-pokedata.md` §4).
- **The Suggestions section** (section 7 of the Analysis tab) — up to five
  ranked cards (addition mode below six members, replacement mode at a
  full six), each showing sprite, types, gain, composite score, newly
  covered types and new weaknesses; a generation dropdown and "include
  custom Pokémon" toggle live on the screen, while "include Mega/Dynamax
  forms" and "include legendaries/mythicals" are app-wide Settings
  preferences (Phase 5) — matching `legacy-web`'s own read-only props for
  those two.
- **The team generator** (`domain/generator/`) — a direct port of
  `teamGenerator.ts`'s `buildEligiblePool`/`generateTeam`/`regenerateSlot`/
  `STARTER_FINALS`, with an injectable `kotlin.random.Random` (the
  TypeScript calls `Math.random()` directly and so can only test
  probabilistically; the Kotlin tests assert the same properties
  deterministically across a fixed set of seeds).
- **The Surprise Me screen** (`ui/surprise/`, reached from Teams via the
  dice icon) — lock 0-5 anchor Pokémon, tune starter/legendary-mythical/
  Mega/Dynamax/custom constraint counters, Generate, regenerate a single
  slot or the whole team, then Keep to create a brand-new team from the
  result. One scrollable screen, not `SurpriseMeModal.tsx`'s three-step
  wizard — see `docs/implementation-decisions.md`, "Phase 4".
- **The Showdown format** (`domain/showdown/ShowdownFormat.kt`) — a direct
  port of `showdownParser.ts`'s export/parse/import functions, contract-
  complete (species/ability/moves/`# Types:` comment on both sides, an
  unresolved move importing as a flagged placeholder rather than failing
  the block). Export is a team's overflow-menu dialog (copy to clipboard
  or save a `.txt` file via SAF); Import is its own Settings-reached
  screen (paste or open a file, review what parsed, then create a
  brand-new team from it).
- **Every setting from the old web app now exists**, alongside what
  Phase 1 already added: "Team Suggestions" (include Mega/Dynamax/
  Gigantamax forms, include legendaries/mythicals — both `SettingsPreferences`,
  renamed from `ThemePreferences` since it now holds far more than the
  theme), Import/Export, Local backup, and the app version.
- **Local backup** (`domain/backup/` + `data/backup/`) — a zip holding
  every team and the custom roster (never the Pokédex cache), versioned
  so a backup from a newer app version is refused rather than partially
  applied; restore is a full replace in one transaction, ids and
  timestamps preserved. Copied from Hall of Memories' own pattern, minus
  the `images/` half neither app's data model needs the same way here —
  CoverDex has no photos on a team slot.
- **`./gradlew testDebugUnitTest lintDebug assembleDebug`** all green in one
  invocation — 336 unit tests as of 2026-09-12 (counted via
  `grep -rc "@Test" app/src/test`), 0 failures (verified locally with a
  temporary, non-persistent SDK this session, same as every prior phase).
- **The release pipeline** — `signingConfigs["release"]` (Phase 0) reads
  `RELEASE_KEYSTORE_PATH`/`RELEASE_KEYSTORE_PASSWORD`/`RELEASE_KEY_ALIAS`/
  `RELEASE_KEY_PASSWORD` env vars and falls back to an unsigned build when
  they're absent; `.github/workflows/build-apk.yml` (manual signed-build
  smoke test) and `.github/workflows/release.yml` (validates a `x.y.z`
  input, cuts `CHANGELOG.md`'s `[Unreleased]` section, bumps
  `versionCode`/`versionName`, builds, signs, publishes the GitHub Release
  with the changelog's bold lead-ins, pushes the version bump) are both
  written and YAML-validated. `docs/release-signing.md` documents the five
  required secrets and what generating the real keystore is left to the
  repository owner, not this agent.
- **`legacy-web/` deleted** — every engine, string and behaviour it defined
  (coverage maths, ability effects, suggestion scoring and its 0.5/1.0
  weights, `STARTER_FINALS`, the Showdown format, both language files) was
  checked against its native Kotlin equivalent before removal; see
  `docs/implementation-decisions.md`, "Phase 6".
- **`README.md`, `ROADMAP.md`, `.github/CONTRIBUTING.md`** rewritten to
  describe the finished native app — no remaining web/PWA/Capacitor/npm
  references anywhere in the repository outside `docs/plan/` (kept
  deliberately, as the historical record of how the app was built).
- **Phase 7 — Room schema v3** (`poke_species.baseStatTotal`,
  `team_member.item`, `custom_pokemon.item`, plus the new
  `poke_pokemon_ability`/`poke_species_bst_past` cache tables), reached
  from v2 by `MIGRATION_2_3` and exercised by `Migration2To3Test`; the
  dataset schema version bump forces every existing install to re-sync
  and pick up base stats and canonical per-form abilities.
- **Phase 7 — correct ability/move names and the canonical-plus-custom
  ability picker.** `PokemonEntry.defaultAbility`, every `TeamMember`'s
  ability, and every move name now come from PokéAPI's own English name
  data instead of a naive hyphen-to-space conversion; `ui/common/
  AbilityPicker.kt` offers a species' real abilities (normal, then
  hidden) with a "Custom ability…" fallback that still accepts anything,
  same contract as before.
- **Phase 7 — ten previously-unmodelled abilities plus an offensive
  gap.** Heatproof, Water Bubble, Purifying Salt, Filter, Solid Rock,
  Prism Armor, Primordial Sea, Desolate Land, Delta Stream, Tera Shell
  now affect the coverage calculation; Wonder Guard is a real effect, not
  a display-only badge; Scrappy/Mind's Eye and the `-ate`/Normalize
  abilities are honoured in the offensive coverage grid.
- **Phase 7 — held items, defensive subset.** `domain/item/ItemEffects.kt`
  models Air Balloon, Iron Ball, Ring Target and one resist berry per
  type; `TeamMember.item` round-trips through Room, Showdown export/
  import and local backups (format version 2).
- **Phase 7 — BST-aware suggestion ranking and a configurable suggestion
  count.** The ranking's tie-break (after composite score and
  final-evolution status) is now base stat total, generation-aware via
  `bstResolverFor`, before falling back to catalogue id; Settings has a
  5-10 stepper for how many suggestions the Analysis tab shows.
- **Phase 7 — the coverage/suggestion engine verified exhaustively**, not
  spot-checked: every one of the 324 type-chart cells, and
  `defensiveMultiplier`/`defensiveProfile` against the complete 171-typing
  space (18 single types + all 153 unordered dual-type pairs) — see
  `docs/post-migration-review.md`, "Phase 7 audit", for the findings this
  surfaced that were deliberately deferred rather than fixed in-phase.

## What's known to be missing

Nothing from `docs/plan/native-spec.md` or `docs/plan/
phase-7-accuracy-and-customization.md` — all six phases of
[`docs/plan/README.md`](plan/README.md), plus Phase 7, are done, and the
release pipeline has already shipped `2.0.0` and `2.0.1` (see above). The
one open item is releasing the `[Unreleased]` Showdown import fix — see
[`docs/next-steps.md`](next-steps.md).

Also deliberately deferred (not a bug, see `docs/implementation-decisions.md`
and, for the Phase 7 items, `docs/post-migration-review.md`'s "Phase 7
audit"):

- **Phase 7** — generational type charts and generational typings
  (`type_efficacy_past.csv`/`pokemon_types_past.csv`, downloaded but
  unread) — a genuine feature with no existing "which generation's rules"
  concept to hang it on, tracked in `ROADMAP.md`.
- **Phase 7** — `Suggestion.gain`'s meaning differs between addition and
  replacement mode, `weaknesses()` counts weakness types rather than
  magnitude (so a x4 and a x2 weakness score identically), replacement
  mode computes one context's score twice, and a custom roster entry
  named after a catalogue species can be silently deduplicated away — all
  four are pre-existing suggestion-engine characteristics found while
  auditing it for Phase 7, each with its own reason for not being folded
  into that phase; see `docs/post-migration-review.md`.
- **Phase 2** — the slot editor's species picker never offers the custom
  roster as a search source, unlike `legacy-web`'s own "Include saved
  custom Pokémon in search" checkbox — `phase-2-teams-and-roster.md`'s own
  description of the species picker never mentions it. "Save as custom"
  (writing a slot *into* the roster) is unaffected.

[`ROADMAP.md`](../ROADMAP.md) points at
[`docs/plan/native-spec.md`](plan/native-spec.md)'s "Explicitly out of
scope" for what's deliberately never planned (Play Store submission, iOS,
a backend).

## Known regressions

See `docs/test-plan.md`'s per-phase "Known regressions" sections for the
full, dated list of real bugs found and fixed (six from the
post-migration review, plus the 2026-09-12 Showdown import fix) — not
repeated here to avoid two copies going stale independently. The one deliberate, non-regression gap: **upgrading from the old
Capacitor build loses saved teams and the custom roster.** This is a decided
trade-off (see `docs/implementation-decisions.md`), not a bug, but it will
read as one to a real user with existing data unless Phase 6's release notes
say so plainly before they update.

## Verifying project health

```bash
export ANDROID_HOME=...    # if a local SDK is available; otherwise rely on CI
./gradlew testDebugUnitTest   # 336 tests as of 2026-09-12
./gradlew lintDebug
./gradlew assembleDebug
```

`docs/test-plan.md` has the on-device manual steps this doesn't cover —
locale switching, dynamic colour, the launcher icon, install-over-upgrade,
the real first-launch sync, team/slot/roster CRUD, the slot editor's
discard-on-back behaviour, the debug seed data, the Analysis tab's basis
notice, both coverage grids' independent horizontal scrolling, type
overrides propagating into the analysis, the Suggestions section's
addition/replacement modes and filters, every Surprise Me interaction
(anchors, constraints, generate, regenerate, Keep), and (new this phase)
Showdown export/import (clipboard, SAF file pickers, unknown-move/skipped-
species handling), a real local-backup export/restore cycle including
across a reinstall, a real signed release build via
`.github/workflows/build-apk.yml` or `release.yml`, and (new this phase)
the canonical-plus-custom ability picker, the item field and its
Showdown/backup round-trip, and an upgrade from a Room-v2 install picking
up base stats and canonical abilities on re-sync.
