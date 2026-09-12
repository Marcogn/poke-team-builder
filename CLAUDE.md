# CLAUDE.md

Guide for AI coding agents working on this repository. Read it in full
before editing anything, then read the phase plan you are executing.

- [`docs/plan/native-spec.md`](docs/plan/native-spec.md) — the authoritative
  functional specification for the native app. Anything not in it, or in a
  phase plan, is out of scope.
- [`docs/plan/README.md`](docs/plan/README.md) — how the phased build is
  executed, the working rules, and the definition of done for every phase.
- [`docs/plan/reference-pokedata.md`](docs/plan/reference-pokedata.md) —
  the measured dataset contract: sources, sizes, field derivations, sprite
  URLs, pinning. The single most important file in the plan.
- [`docs/implementation-decisions.md`](docs/implementation-decisions.md) —
  non-obvious choices and why they were made. Add to it as you go.
- [`docs/test-plan.md`](docs/test-plan.md) — manual, on-device verification.
  One new section per phase; one "Known regressions" entry per real bug found.
- [`CHANGELOG.md`](CHANGELOG.md) — one entry per release, updated as you go.
- [`docs/plan/phase-7-accuracy-and-customization.md`](docs/plan/phase-7-accuracy-and-customization.md)
  — the most recently completed phase's plan (status: done): what was
  wrong with the engines before it (measured, with the dataset evidence)
  and exactly what was built to fix it. No phase 8 exists yet — no
  further phase is currently planned.

## What this project is

CoverDex is a native, single-user, offline-first Android app for building
Pokémon teams and analysing their type coverage, offensively and
defensively. It supports custom Pokémon and per-slot type overrides, which
is what makes it useful for ROM hack runs and draft building. Kotlin +
Jetpack Compose + Material 3, Room, Hilt, ViewModel/StateFlow with
unidirectional data flow.

It is **not** a battle simulator, **not** a Pokémon Showdown replacement,
and **not** a damage calculator.

| | |
|---|---|
| Repository | `marcogn/coverdex` |
| Gradle root project | `CoverDex` |
| `applicationId` / package | `com.marcogn.coverdex` |
| Database file | `coverdex.db` |
| minSdk / targetSdk / compileSdk | 24 / 36 / 36 |

CoverDex is a rewrite of a working app, not a new one. It used to ship as a
React/Capacitor PWA on GitHub Pages; that path is gone (see
[`docs/plan/phase-0-foundation.md`](docs/plan/phase-0-foundation.md)) and
the app is native-only from here on.

## Sibling projects

- **Hall of Memories** (`marcogn/hall-of-memories`) — same author, same
  stack, six shipped phases. It is the **architectural** reference: Gradle
  setup, the version catalogue, Hilt modules, Room + `Flow` + `combine()`
  ViewModels, the `HttpURLConnection` client style, the sprite fallback
  composable, the SAF backup pattern, and all three CI workflows.
  **Copy its patterns rather than inventing new ones.**
- **`legacy-web/`** — this repository's own parked React/Capacitor code,
  the **behavioural** reference for the whole rewrite (the coverage
  maths, the suggestion ranking, the composite score weights, the
  Showdown format contract, every UI string in both languages) up through
  Phase 5. Phase 6 checked every one of those against its native Kotlin
  equivalent (see `docs/implementation-decisions.md`, "Phase 6") and
  deleted the directory — it no longer exists in this repository.
  `docs/plan/` was kept as the historical record of how the rewrite was
  reasoned about and built.

## Progress status by phase

- **Phase 0 — Foundation**: ✅ done
- **Phase 1 — Dataset sync**: ✅ done
- **Phase 2 — Teams and roster**: ✅ done
- **Phase 3 — Analysis**: ✅ done
- **Phase 4 — Suggestions and generator**: ✅ done
- **Phase 5 — Import/export and settings**: ✅ done
- **Phase 6 — Release**: ✅ done
- **Phase 7 — Engine accuracy, abilities/items, BST ranking**: ✅ done —
  see [`docs/plan/phase-7-accuracy-and-customization.md`](docs/plan/phase-7-accuracy-and-customization.md)

Tick these off as phases land — here and in
[`docs/plan/README.md`](docs/plan/README.md). Do not implement anything not
present in `docs/plan/native-spec.md` or a phase plan unless a new session
explicitly asks for it.

## Product decisions already made (do not ask again)

- **`applicationId` stays `com.marcogn.coverdex`** and **`minSdk` stays
  24** — both carried over from the Capacitor build. The native app must
  install over it, and nothing here needs `java.time`, so there's no
  reason to drop API 24–25. `versionCode` starts at 2 (the Capacitor build
  shipped 1) so the upgrade path exists at all.
- **No data migration from the Capacitor build.** A clean break, decided
  explicitly rather than deferred. Users upgrading in place start with an
  empty team list; Phase 6's release notes must lead with that warning and
  tell users to export their teams to Showdown format first. See
  `docs/implementation-decisions.md`.
- **The dataset sync reads PokéAPI's own CSV source data, not its JSON
  mirror.** ~12 requests and ~565 KB (8 requests/~208 KB through Phase 6;
  Phase 7 added base stats and correct English ability/move names)
  instead of ~3875 requests and ~426 MB — measured, not estimated. See
  `docs/plan/reference-pokedata.md`.
- **Sprite URLs are derived, never stored**, from a Pokémon's id alone.
- **Species/type-override/ability/move values on a team slot are
  denormalized snapshots**, not references into the cached catalogue.
  Wiping the cache must never alter or blank a saved team.
- **The generation filter uses each species' real introduction
  generation**, not hardcoded id ranges — the one intentional behavioural
  change from the PWA. See `docs/plan/reference-pokedata.md` §4.
- **Backups never contain the cached catalogue** — it is re-downloadable
  data. **Restore is a full replace**, single transaction, ids and
  timestamps preserved. No merging, no conflict resolution.
- **No Play Store submission, no iOS, no backend of any kind.** See
  `docs/plan/native-spec.md`, "Explicitly out of scope" — a backend in
  particular has been proposed and turned down twice; don't reopen it
  without a measured, reproduced performance problem to point at.

## Architecture

The shape as it stands at the end of Phase 7 (the six-phase native rewrite
plus the engine-accuracy/customization phase that followed it): `ui/theme`,
`ui/navigation`, `ui/teams` (real CRUD, plus the dice icon reaching Surprise
Me), `ui/team` (team detail, the slot editor, `MoveSlotEditor`,
`SlotSummaryCard`), `ui/team/analysis` (`AnalysisScreen`'s seven sections,
`AnalysisViewModel`, `CoverageGridTable`, `PerPokemonCard`, `SuggestionCard`,
`SuggestionFilters`), `ui/surprise` (`SurpriseMeScreen`,
`SurpriseMeViewModel`, the team generator's own screen), `ui/roster` (real
CRUD, its own editor), `ui/importexport` (`ImportShowdownScreen`,
`ImportShowdownViewModel`, `ExportShowdownDialog`), `ui/settings` (theme,
language, dataset status, the Showdown import entry point, local backup, and
the Phase 7 suggestion-count stepper), `ui/common` (`PokemonSprite`,
`TypeBadge`, `SearchableDropdown`, `EditableComboBox`, `TypeDropdown`,
`DamageClassDropdown`, `AbilityPicker`/`ItemPicker` (Phase 7's
canonical-plus-custom ability field and the item field), `StepperCounter`
(the shared `−`/`+` row Surprise Me and Settings both use), the
`PokemonType`/`DamageClass` `displayName()` extensions), `domain/coverage`
(the ported coverage engine, extended in Phase 7 with the ability/item
effect pipeline), `domain/ability` (`AbilityEffects` — the ported table plus
Phase 7's ten added defensive abilities and the offensive gap), `domain/item`
(Phase 7's `ItemEffects` — the defensive-items-only subset),
`domain/suggestion` (the ported suggestion engine + the shared `Scoring.kt`,
now BST-tie-break-aware), `domain/generator` (the ported team generator,
injectable `Random`), `domain/showdown` (`ShowdownFormat.kt`: export/import,
contract-complete, items round-trip as of Phase 7),
`domain/backup` (`BackupPayload.kt`: versioned DTOs + mapping, format v2 as
of Phase 7), `data/backup` (`BackupArchive.kt` zip read/write,
`LocalBackupManager.kt` SAF plumbing), `data/settings/SettingsPreferences.kt`
(theme, language, the persisted "Enable move slots" toggle, and every other
app-wide setting — include Mega/Dynamax, include legendaries, include
customs in analysis, the Phase 7 suggestion count), `data/debug/DebugSeeder.kt`
(seeds two teams and two roster entries, wired from `CoverDexApplication`),
and the full `data/pokeapi`, `data/local`, `data/repository`, `domain/pokeapi`,
`domain/sprite`, `domain/model`, `domain/repository` and `di` packages the
tree below describes.

```
com.marcogn.coverdex
├── data/
│   ├── local/        Room: entity/, dao/, Converters, CoverDexDatabase, Migrations
│   ├── repository/   repository implementations (transactional) + Mappers
│   ├── pokeapi/      PokeDataClient (HttpURLConnection), DatasetSyncManager
│   ├── backup/       BackupArchive (zip), SAF import/export
│   ├── settings/     SettingsPreferences (DataStore) + every other app-wide setting, one file
│   └── debug/        DebugSeeder, behind BuildConfig.SEED_DEBUG_DATA
├── domain/
│   ├── model/         pure models, enums — no Android imports
│   ├── pokeapi/        CsvParser, per-file parsers, dataset assembly, SyncStage
│   ├── sprite/          SpriteUrlResolver (pure, unit-tested)
│   ├── coverage/       the ported coverage engine
│   ├── ability/          AbilityEffects (ported verbatim + Phase 7 additions)
│   ├── item/             ItemEffects (Phase 7, defensive items only)
│   ├── suggestion/     the ported suggestion engine + shared Scoring
│   ├── generator/       the ported team generator ("Surprise Me")
│   ├── showdown/        export/import, contract-complete
│   ├── backup/           BackupPayload DTOs + mapping
│   └── repository/     repository interfaces
├── di/                Hilt modules (Database, Repository, Coroutines, Network)
└── ui/
    ├── theme/         Material 3 theme + ThemeViewModel
    ├── navigation/    type-safe routes, ModalNavigationDrawer around the NavHost
    ├── teams/         the teams list
    ├── team/           team detail: Pokémon tab (slot editor) + Analysis tab
    ├── roster/        the custom Pokémon roster
    ├── surprise/      the team generator screen
    ├── settings/      theme, language, dataset, import/export, backup
    └── common/        shared composables (PokemonSprite, TypeBadge, SearchableDropdown, ...)
```

**Room is the single source of truth**, exposed as `Flow`. ViewModels
`combine()` repository flows with local UI state into one `StateFlow` of UI
state; events flow up as lambdas, state flows down. Pure logic lives in
`domain/` with no Android imports so it is testable on the plain JVM
without Robolectric — this split is what makes the ported engines directly
comparable to their `legacy-web` originals.

## Code conventions

- **Code, comments, commits and docs are English.** Only the UI's string
  resources are bilingual: `res/values/strings.xml` is Italian (the default
  locale), `res/values-en/strings.xml` English. Add a key to both in the
  same commit — a key present in only one silently falls back to Italian.
  Every string carried over from the old web app was ported from its
  `i18n/locales/{it,en}.json` wording before `legacy-web/` was deleted in
  Phase 6; a genuinely new, native-only string (see
  `docs/implementation-decisions.md` for the language picker's "System
  default" option, which has no PWA equivalent) has no such source to
  match and can be written fresh.
- **No hardcoded user-visible strings**: `stringResource()` in Compose,
  `context.getString()` in ViewModels (inject `@ApplicationContext`).
- Ids: `String` UUIDs for user data, generated in the repository. The
  cached catalogue keeps PokéAPI's own `Int` ids.
- **Room migrations are additive and numbered.**
  `fallbackToDestructiveMigration()` is banned — from Phase 2 onward the
  app holds data that cannot be re-created.
- **No new dependencies** without an explicit request or a genuine need.
  The catalogue is pinned in Phase 0 and closed. CSV parsing, the HTTP
  client, the sprite fallback chain and the placeholder art are all
  hand-rolled, exactly as in the sibling app.
- No mock data in shipped UI; the only seed is `data/debug/DebugSeeder.kt`
  behind `BuildConfig.SEED_DEBUG_DATA` (debug builds only, from Phase 2).

## Known gotchas

Carried over from the sibling project; each one cost real debugging time
there.

- **`MainActivity` must extend `AppCompatActivity`.** With
  `ComponentActivity`, `AppCompatDelegate.setApplicationLocales()` is
  silently ignored and the in-app language picker does nothing. The app
  theme must then descend from `Theme.AppCompat.*`.
- **The system back gesture bypasses a screen's custom `onBack`** — Compose
  Navigation's own callback just calls `popBackStack()`. Any screen with
  custom back logic needs an explicit `BackHandler`.
- **Do not set `Accept-Encoding` on `HttpURLConnection`.** Left alone it
  negotiates gzip and decompresses transparently; set it by hand and you
  get raw gzip bytes. Matters more here than in the sibling app: CSV
  compresses very well, so the measured ~565 KB in
  `docs/plan/reference-pokedata.md` is what crosses the wire uncompressed.
- **kotlinx.serialization defaults do not cover an explicit `null`.** A
  default value only fills a *missing* key; `"field": null` still throws
  unless the type is nullable. Set `coerceInputValues = true` too.
- **`Json.encodeToString(value)`** without
  `import kotlinx.serialization.encodeToString` resolves to the wrong
  overload and fails with a misleading type error.
- **Never `clearAllTables()`** — cache invalidation must name the cache
  tables explicitly or it takes the user's teams and roster with it.
- **Every Robolectric test class needs `@Config(sdk = [26])`.** Robolectric's
  shadow jar for this app's `compileSdk` (36) requires a newer JDK than CI
  runs (`android-ci.yml` pins JDK 17) — without the pin, the test passes
  locally on a machine with a newer JDK and fails in CI with a confusing
  `UnsupportedOperationException at DefaultSdkProvider.java` that doesn't
  name the real cause. The pin is about Robolectric's JDK requirement, not
  a claim about this app's own `minSdk` (which stays 24) — sdk 26 just
  happens to be the same version the sibling app already validated this
  workaround against.
- **This sandbox's default locale is POSIX (non-UTF-8).** A non-ASCII
  character (an em dash, accented letter, etc.) in a Kotlin backtick test
  method name breaks `compileDebugUnitTestKotlin` with an opaque
  `InvalidPathException`, because the generated `.class` filename can't be
  encoded in that locale. Keep test names plain ASCII.
- **`@Insert(onConflict = OnConflictStrategy.REPLACE)` is not an update on
  a row with `ON DELETE CASCADE` children.** It compiles to SQLite
  `INSERT OR REPLACE`, which deletes the conflicting row before
  reinserting it — a real, on-device bug in the sibling app: an upsert used
  for editing a parent row silently cascade-deleted every child row
  underneath it. Any table that is the parent side of a cascading foreign
  key (from Phase 2 onward: `team` → `team_member` → `team_member_move`)
  needs a real `@Update` for its edit path, or must delete-and-reinsert
  every child in the *same* transaction right after. Check any future
  `REPLACE`-based upsert against this before assuming it's safe.
- **Room's `MigrationTestHelper` needs its schema JSONs on the `debug`
  source set's assets, not `test`'s.** The commonly repeated advice
  (`sourceSets["test"].assets.srcDirs("$projectDir/schemas")`, carried over
  from the officially documented `androidTest` pattern) does nothing under
  Robolectric: `MigrationTestHelper` reads schemas through a real
  `AssetManager.open()` call, whose Robolectric shadow is backed by
  whatever directory AGP's generated `test_config.properties` names as
  `android_merged_assets` — which is the actual `debug` variant's
  `mergeDebugAssets` output, not a `debugUnitTest`-specific one (this AGP
  version has no such task). `app/build.gradle.kts` wires the schemas into
  `sourceSets["debug"].assets` instead, which is what actually makes
  `Migration1To2Test` pass. See `docs/implementation-decisions.md`,
  "Phase 2", for how this was verified rather than assumed.
- **`ALTER TABLE ... ADD COLUMN` needs a `DEFAULT` when the column is
  `NOT NULL`.** SQLite (and therefore Room's own migration SQL) rejects a
  `NOT NULL` column added this way with no default — every pre-existing
  row would have nothing to put there. `MIGRATION_2_3`'s
  `poke_species.baseStatTotal` column needs `DEFAULT 0` in the raw SQL
  *and* a matching `@ColumnInfo(defaultValue = "0")` on the Kotlin field,
  or `MigrationTestHelper`'s schema validation flags the mismatch. A
  nullable added column (`team_member.item`, `custom_pokemon.item`) needs
  neither — `NULL` is already a valid default for every existing row.

## Build/test commands

```bash
./gradlew assembleDebug            # debug APK
./gradlew testDebugUnitTest        # JVM unit tests (domain + Robolectric)
./gradlew lintDebug                # Android Lint
./gradlew connectedDebugAndroidTest  # instrumented tests (needs a device)
```

Real verification happens in `.github/workflows/android-ci.yml` on every
push/PR. A sandboxed session may have the Maven repositories reachable but
no Android SDK — check `$ANDROID_HOME` and `command -v sdkmanager` before
assuming a local build is possible, and fall back to CI rather than
fighting it. Never report a build as passing that you did not run.

Testing approach: pure JVM unit tests for everything in `domain/`
(the coverage, suggestion and generator engines; the CSV parser; the
Showdown parser; sprite resolution; ability effects); Robolectric as JVM
tests for Room DAOs, repositories and the backup archive. Anything needing
the real network, locale switching, the SAF pickers or real image
rendering is verified by hand — see `docs/test-plan.md`.

`legacy-web/` was the oracle for the Kotlin ports throughout the migration
and has been deleted as of Phase 6 — see "Sibling projects" above.

## Changelog and release process

`CHANGELOG.md` is the release-notes source of truth. **Every change gets
its entry when it is made**, under `## [Unreleased]` at the top — never
deferred to release time.

Entry convention: one top-level bullet per significant, user-facing
change, leading with a short bold summary — `- **Summary.** further
detail…` — with nested bullets for detail. Phase 6's `release.yml`
extracts exactly those bold lead-ins into the GitHub Release body. Keep
the bold span short and skimmable.

## What NOT to do until explicitly requested

Anything not in `docs/plan/native-spec.md`. Named explicitly there,
"Explicitly out of scope": any web build (GitHub Pages, the PWA manifest,
Vite, Capacitor), a backend of any kind, Play Store submission, iOS,
migrating data from the Capacitor build, damage calculation, battle
simulation, EV/IV tracking, legality validation.
