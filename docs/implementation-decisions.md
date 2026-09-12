# Implementation decisions

Non-obvious choices made while executing the native Android migration plan
(`docs/plan/`), and why. Add an entry here whenever a phase requires a
judgment call the plan didn't already settle. One section per phase.

## Phase 0 — Foundation

- **`minSdk` stays 24, not Hall of Memories' 26.** The Capacitor build
  shipped `minSdk 24` and nothing in this app needs `java.time` (the only
  reason Hall of Memories requires 26 without desugaring). Raising it would
  drop real API 24–25 devices for no benefit. If a later phase genuinely
  needs `java.time`, the right fix is raising `minSdk` then, with a
  changelog note — not adding desugaring now against a need that doesn't
  exist yet.
- **`versionCode` starts at 2, `versionName` at "2.0.0".** The Capacitor
  build shipped `versionCode 1` / `versionName "1.0"`; the native app must
  be installable over it, so `versionCode` has to increase. The major
  version bump (`1.x` → `2.0.0`) is honest: this release drops the web app
  entirely and does not carry user data forward (see the next entry).
- **No data migration from the Capacitor build — decided, not deferred.**
  The old app persisted `teamdex_userdata` in `@capacitor/preferences`
  (native Android SharedPreferences under a Capacitor-specific key/format).
  Reading and converting that format into Room was considered and rejected
  in the planning session (see `docs/plan/native-spec.md`, "Storage"): the
  user explicitly chose a clean break over the added complexity and risk of
  a one-shot migration path that only ever runs once per device and is
  otherwise dead code forever after. Consequence: anyone upgrading in place
  loses their saved teams and custom roster silently unless warned first.
  Phase 6's release notes must lead with this, in plain language, with the
  concrete mitigation (export each team to Showdown format from the old
  app before updating) — not buried under feature bullets.
- **The launcher icon is a verbatim copy of the Capacitor build's mipmap
  set, not a re-laid-out vector.** The phase file's literal instruction was
  to "recover the foreground drawable and re-lay it out as
  `mipmap-anydpi-v26/ic_launcher.xml` + the density buckets" (implicitly
  assuming a vector source, as in Hall of Memories). Inspection showed the
  Capacitor asset is already a complete, correct Android launcher icon set
  — raster `ic_launcher_foreground.png`/`ic_launcher_background.png` per
  density (mdpi through xxxhdpi, 108dp), a legacy raster
  `ic_launcher.png`/`ic_launcher_round.png` fallback per density for
  pre-API-26 devices (needed here since `minSdk` is 24, unlike Hall of
  Memories' 26), and `mipmap-anydpi-v26/ic_launcher{,_round}.xml` using an
  inset foreground. Copying it unchanged is strictly more faithful to "the
  app's visual identity does not change in this rewrite" than reconstructing
  it as a hand-authored vector would have been, and it already handles the
  pre-26 fallback the vector approach doesn't. `./gradlew lintDebug`
  confirms it's a valid, complete adaptive icon (only a benign "missing
  monochrome tag" advisory, an Android-13+ nicety absent from the original
  Capacitor asset too — not a regression, not fixed here).
- **Settings' three-way language picker (System/Italian/English) has no
  PWA equivalent.** `legacy-web`'s i18next-based switcher
  (`src/components/Settings/SettingsPage.tsx`) exposes only two bare
  buttons, `EN`/`IT`, no spelled-out names, and no "follow the system
  locale" option — i18next has no concept of tracking the OS locale
  automatically the way `AppCompatDelegate.setApplicationLocales(empty)`
  does. Since Rule 4 ("port the text, do not reinvent it") has no PWA
  wording to port for this native-only feature, the three option labels
  ("Predefinito sistema"/"System default", "Italiano"/"Italian",
  "Inglese"/"English") are ported from Hall of Memories' Settings screen
  instead, which already solved the identical UI problem.
- **The theme picker's three labels ARE ported from `legacy-web`**, unlike
  the language picker above — `settings.systemDefault`/`light`/`dark`
  already exist in `legacy-web/src/i18n/locales/{it,en}.json` for exactly
  this picker (`SettingsPage.tsx`'s theme `<select>`), so those exact
  strings were used rather than Hall of Memories' shorter "Sistema"/"Tema".
- **Theme colour roles are seeded from the brand purple `#5B21B6`**, not a
  new palette. That hex is the Capacitor adaptive-icon background
  (`android:icons` npm script's `--iconBackgroundColor`) and the PWA's own
  accent color — it already sits almost exactly at Material 3's
  conventional "tone 40" lightness for a light-scheme primary color (42%
  lightness, measured), so it was used directly as `primary` rather than
  algorithmically adjusted. `primaryContainer`/`onPrimaryContainer` and the
  dark-scheme roles were derived by holding hue and saturation constant and
  shifting only lightness (a plain HSL adjustment, not a full Material
  color-utilities HCT computation — no such dependency is in the pinned
  catalogue and Phase 0 doesn't add one). Material You dynamic colour
  (API 31+) overrides all of this anyway; the manual scheme only matters on
  older devices and when the user has dynamic colour off.
- **`Destination.TeamDetail`'s route exists in the sealed interface but has
  no `composable<>` registered in the `NavHost` yet.** Nothing navigates to
  it until Phase 2 gives Teams real CRUD and TeamDetail a screen to show;
  registering a route with no reachable screen would mean inventing a
  placeholder Phase 0 doesn't need. The type's shape is what needs to be
  stable for Phase 2, not its wiring.
- **Verified locally with a temporary Android SDK, not committed.** The
  sandboxed session had no `ANDROID_HOME` by default (matching
  `docs/plan/README.md`'s documented default), but `dl.google.com` was
  reachable, so `cmdline-tools` + `platform-36` + `build-tools` were
  installed to `/tmp/android-sdk` (outside the repo, `.gitignore`d either
  way via `local.properties`) specifically to run `assembleDebug`,
  `lintDebug` and `testDebugUnitTest` for real rather than only trusting
  `android-ci.yml` to catch a problem. All three were green. This is not an
  assumption future sessions can rely on — check `$ANDROID_HOME` and
  `command -v sdkmanager` per `docs/plan/README.md` before assuming a local
  build is possible, and fall back to CI if it isn't.

## Phase 1 — Dataset sync

- **`isDefaultForm` was added to `PokemonEntry`**, mid-phase, once Room's
  schema (§2) turned out to need it (`poke_species.isDefaultForm`) for
  search ranking but the domain model didn't carry it yet. Sourced from
  `pokemon.csv`'s already-parsed `is_default` column. Keeping it on the
  domain model rather than only on the entity is what CLAUDE.md's
  architecture already commits to ("Room is the single source of truth...
  Pure logic lives in `domain/`") — an entity should never carry data the
  domain layer has nowhere to read from.
- **No `Converters.kt`.** Every field on every Phase 1 entity is a native
  Room type (`String`/`Int`/`Boolean`/`Double`) — a converter class with
  nothing to convert would be dead ceremony. Same judgment as Phase 0
  skipping an empty `di/NetworkModule.kt` — except this phase's
  `NetworkModule.kt` ended up with real content once `DatasetSource` (next
  entry) needed a `@Binds`.
- **`PokeDataClient` sits behind a `DatasetSource` interface.** No mocking
  library is in the pinned catalogue, and `DatasetSyncManager`'s tests
  (a failing fetch leaves the database untouched; a successful one writes
  every table; a fresh cache never touches the network at all) need to
  control what a fetch returns or whether it throws. A hand-written fake
  implementing a one-method interface does that without a new dependency;
  `PokeDataClient` is the only real implementation, bound in
  `di/NetworkModule.kt`.
- **The repository interface dropped `suspend fun sync(): Result<Unit>`**
  from the plan's original one-paragraph sketch, in favour of Hall of
  Memories' fire-and-forget `startSyncIfNeeded()`/`forceResync()` (both
  non-suspend, observed via `syncState: StateFlow<SyncState>`). The
  awaitable version has a real race: `startIfNeeded()`/`forceResync()`
  launch onto a detached application-scoped coroutine, so a caller
  immediately awaiting `state.first { terminal }` can observe a *stale*
  terminal value left over from a previous run before the newly-launched
  attempt has had a chance to flip the state to `Running`. Hall of
  Memories' simpler shape has no such race because nothing needs to await
  a specific run's own outcome. Rule 2 ("Copy Hall of Memories, don't
  invent") applied against my own draft, not just the plan's — worth
  naming explicitly since the plan's sketch was mine to begin with.
- **`PokedexRepository` exposes both `cacheStatus` and `syncState`**, not
  just the one `cacheStatus` the plan's sketch listed. `CacheStatus` is a
  snapshot of the *persisted* meta row (usable/synced-at/counts/revision);
  it has no notion of "a sync is running right now with this stage and
  progress". The Teams screen's non-blocking banner and Settings' inline
  progress bar both need that live signal, so `syncState` (a direct pass-
  through of `DatasetSyncManager.state`) was added as a second observable
  rather than folding a "current stage" field into `CacheStatus` itself,
  which would conflate "what's saved" with "what's happening right now".
- **Search ranking goes beyond the plan's one-line sketch.** The DAO's
  `LIKE` queries rank a prefix match on the normalized name ahead of a
  contains-only match, and within a tie a species' default form ahead of
  its alternate forms (searching "zygarde" surfaces `zygarde-50` before
  `zygarde-mega`) — both proven against real ranking SQL in
  `PokedexDaoTest`, not just asserted as intent. This mirrors Hall of
  Memories' `mergeSearchResults` (prefix-then-contains), done as a single
  `CASE`-ordered SQL query instead of two separate DAO calls merged in the
  repository, because the plan's own interface returns `Flow`, not a
  one-shot suspend list — a two-query app-level merge would need to
  `combine()` two live Flows on every emission, which is more complexity
  for the same result.
- **`java.text.SimpleDateFormat`, not `java.time`,** formats the "last
  synced" timestamp in Settings → Data. `minSdk` stays 24
  (`docs/plan/native-spec.md`, "Identity"); `java.time` needs API 26
  without desugaring, which is exactly the trade CLAUDE.md already said not
  to make without a real need. `PokeCacheMetaEntity.syncedAtEpochMillis`
  and `SyncState.Success.syncedAtEpochMillis` are both plain `Long`, not
  `Instant`, for the same reason.
- **`TypeBadge` renders the Scarlet/Violet type-icon sprite**, matching
  `legacy-web/src/components/TypeBadge/TypeBadge.tsx` exactly, rather than
  Hall of Memories' coloured-pill-text convention. CoverDex's own PWA
  already made this call for its own UI; porting the visual language is
  more faithful than porting Hall of Memories' unrelated one.
- **The move-count string is split into manual `_one`/`_other` resources**
  rather than a single `%d` template — lint's `PluralsCandidate` check
  flags either shape identically (confirmed against Hall of Memories'
  already-shipped `strings.xml`, which has 22 identical findings from the
  same `_one`/`_other` convention and still lints clean); this is expected
  noise from a heuristic that doesn't understand the manual split, not a
  real problem worth suppressing or working around further.
- **`DebugSeeder` exists but has no call site yet.** With nothing to seed
  until Phase 2's team/roster tables exist, wiring a call into
  `CoverDexApplication.onCreate()` now would mean exercising Hilt's
  Application-field-injection path — untested here, unverifiable without a
  device — for a function that does nothing. Phase 2 wires it up alongside
  the actual seeding logic, where there's something real to check.

### Parity check against `legacy-web` and the pinned dataset

`cd legacy-web && npm ci && npm test` — 175/175 green, unaffected by
anything in this phase.

Every number in `docs/plan/reference-pokedata.md` §3 was re-verified
against the pinned commit's live files, both by raw `awk`/`csv` counting
and — going one step further than the plan's own instruction — by actually
running `assembleDataset()` against the full pinned CSVs (not the small
test fixtures) in a temporary, throwaway test deleted immediately after
recording its output here:

```
species (forms)          = 1351   (matches: 1351 pokemon.csv rows)
distinct species         = 1025   (matches: 1025 pokemon_species.csv rows)
moves accepted into cache = 919   (see "18 shadow moves" below)
finalEvolutions, species-level = 568   (matches)
legendary, species-level       = 71    (matches)
mythical, species-level        = 23    (matches)
type_efficacy cells             = 324   (matches: 18 x 18)
```

Two things worth writing down so a future reader doesn't trip over them
the way this session briefly did:

- **Species-level counts vs. form-level counts are not the same number,
  and both are correct.** `isFinalEvolution`/`isLegendary`/`isMythical`
  are species-level facts (from `pokemon_species.csv`) applied to every
  *form* that species has. Counting them over the 1351 assembled
  `PokemonEntry` forms (rather than grouping by `speciesId` first) gives
  840/120/38 instead of 568/71/23 — not a bug, just multi-form legendaries
  (Mega/regional/etc. forms) each contributing one row per form. Group by
  `speciesId` before comparing against `reference-pokedata.md`'s numbers,
  which are all species-level.
- **18 of 937 moves never reach the cache** — see
  `reference-pokedata.md`'s new "Consequence, verified during Phase 1
  implementation" bullet for the full explanation (Pokémon Colosseum/XD's
  "Shadow" move set, `type_id = 10002`, outside the 18-type model). 919 is
  the correct count for `PokedexRepository`'s move cache from this point
  on; do not "fix" a future test that expects 937.

## Phase 2 — Teams and roster

- **`MigrationTestHelper`'s exported schema JSONs must be wired in as a
  `debug` source-set asset, not a `test` one — confirmed by measurement,
  not by trusting the widely-repeated advice.** The officially documented
  pattern (Room's own migration guide, countless blog posts and Stack
  Overflow answers) is:
  ```kotlin
  sourceSets {
      getByName("androidTest").assets.srcDirs("$projectDir/schemas")
  }
  ```
  for instrumented tests, and by extension people carry the same
  `sourceSets["test"].assets.srcDirs(...)` (or `resources.srcDirs(...)`)
  over to a Robolectric-based `MigrationTestHelper` test under
  `testOptions.unitTests.isIncludeAndroidResources = true`. Neither worked
  here (`Migration1To2Test`, added this phase, kept failing with
  `FileNotFoundException: ... Missing file:
  com.marcogn.coverdex.data.local.CoverDexDatabase/1.json`), so this was
  run to ground with real build artifacts rather than assumed to be a
  typo:
  - `MigrationTestHelper.loadSchema()` (decompiled from
    `room-testing-2.6.1-runtime.jar`, since the class name obfuscation in
    the error message hides which API it actually calls) genuinely calls
    `instrumentation.context.assets.open("$assetsFolder/$version.json")`
    — a real `android.content.res.AssetManager` read, not a JVM classpath
    resource lookup, confirming Room's own (correct, if easy to misread)
    error wording.
  - Under Robolectric, that `AssetManager` is a shadow backed by whatever
    directory AGP's generated `test_config.properties` names as
    `android_merged_assets` — inspected directly at
    `app/build/intermediates/.../test_config.properties`, which reads
    `android_merged_assets=build/intermediates/assets/debug/mergeDebugAssets`.
    That is the **real `debug` variant's** merged assets output. There is
    no `debugUnitTest`-specific assets merge task in this AGP version
    (confirmed: `./gradlew :app:help --task mergeDebugUnitTestAssets`
    reports the task does not exist) — so a `test`-source-set asset has
    nowhere to be merged *into* before Robolectric looks for it. This was
    verified empirically, not just reasoned about: pointing
    `sourceSets["test"].assets` at the schemas directory left
    `mergeDebugAssets`'s output untouched, and the test still failed
    identically; adding the same directory to
    `sourceSets["debug"].assets` instead made the files appear at
    `app/build/intermediates/assets/debug/mergeDebugAssets/...`, and the
    test passed.
  - The Hall of Memories sibling app was checked first, as the
    architectural reference — it has no precedent to copy here. It has
    never written a second schema version (`app/schemas/` holds only
    `1.json`), so it has never needed `MigrationTestHelper` at all.
  - Net effect: `app/build.gradle.kts`'s `android { sourceSets { ... } }`
    wires `getByName("debug").assets.srcDirs("$projectDir/schemas")`,
    accepting that the exported schema JSONs (a few KB, currently two
    files) ship inside debug-only APK builds. Release builds are
    unaffected — nothing here touches the `release` source set.
- **`MigrationTestHelper`'s two-argument, string-based constructor
  (`MigrationTestHelper(instrumentation, assetsFolder: String, factory)`)
  is deprecated as of Room 2.6.1** in favour of the class-based overload
  (`MigrationTestHelper(instrumentation, databaseClass: KClass<T>, specs,
  factory)`), which is required anyway once a future phase introduces an
  `@AutoMigration`. `Migration1To2Test` uses the class-based constructor
  from the start rather than deferring the fix.
- **A new custom move defaults to `type = NORMAL`, `damageClass = PHYSICAL`,
  not `damageClass = STATUS`** as `phase-2-teams-and-roster.md`'s own prose
  says ("becomes `isCustom = true`, `damageClass = STATUS`, `power = null`").
  That line does not match `legacy-web`'s actual, executable behaviour:
  `MoveSlot.tsx`'s custom-move `onChange` builds
  `{ type: move?.type ?? 'normal', power: move?.power ?? null, damageClass:
  move?.damageClass ?? 'physical', isCustom: true }` — for a brand-new
  custom move, `move` is `null`, so every one of those `??` fallbacks
  fires: `'normal'`, `null`, `'physical'`. Per `docs/plan/README.md`'s own
  rule ("when the Kotlin and the TypeScript disagree ... the TypeScript is
  right unless this plan explicitly says otherwise" — and this is a
  paraphrase slip, not a stated intentional deviation), the code wins. Only
  `power = null` from the plan's prose survives; `type` and `damageClass`
  follow `legacy-web` instead. There is nowhere in the domain model to
  encode "no move yet" versus "a move with defaults" separately from
  `PokemonMove` itself, so this only matters at the moment a slot's
  move-picker text field goes from empty to non-empty with no cached match
  — precisely the case `MoveSlot.tsx` handles this way.
- **Team and roster entity mappers (`TeamMappers.kt`) fall back to a
  default value on an unrecognized `type`/`damageClass` string instead of
  returning `null` and dropping the row**, unlike `PokedexRepositoryImpl`'s
  cache mappers (`Mappers.kt`), which do drop a bad cache row. The cache is
  re-downloadable — a corrupt row is just re-synced away — but a team or a
  roster entry is the user's own irreplaceable data, written exclusively by
  this app's own code (never parsed from an external, occasionally-bad
  source like PokéAPI's CSVs). `parseType`/`parseDamageClass` should never
  actually hit their fallback branch in practice; the fallback exists so a
  future bug in the write path degrades a slot's display rather than
  silently deleting the user's team. Asserted directly in
  `TeamMappersTest`.
- **`TeamDao`/`CustomPokemonDao` get a real column-list `UPDATE` for rename
  (`TeamDao.renameTeam`) and edit (`CustomPokemonDao.updateFields`)**,
  instead of reusing the generic `@Update`-on-the-whole-entity that
  `upsertTeam`/`upsert` already had. Both `TeamEntity.position` (list
  order) and `CustomPokemonEntity.createdAtEpochMillis` (roster sort order)
  must survive an edit unchanged, and the repository has no reason to read
  the existing row first just to copy those two columns forward — a
  column-list `UPDATE` that never mentions them is simpler and cannot
  regress by a future caller forgetting to carry them over. Asserted
  directly: `CustomPokemonDaoTest`'s "editing an entry's name does not
  reset its creation time".
- **The Teams screen's create/rename/delete wording has no `legacy-web`
  source to port for three of its four strings.** `legacy-web/src/i18n/locales/`
  has `teams.newTeam`, `teams.createEmpty` and `teams.delete`, but: renaming
  is an inline double-click-to-edit text field in the PWA with no dialog
  and no "Rename" string anywhere (`teams_rename_team_title`,
  `teams_action_rename`, `teams_team_name_label` are new keys, phrased to
  match the existing `teams_delete_title`/`settings_data_clear_confirm_title`
  style); `DeleteTeamModal.tsx`'s confirmation copy is hardcoded English,
  never run through `t()` — a real localization gap in the PWA, not
  something to carry forward — so `teams_delete_message` is phrased fresh
  (matching `teams.confirmDelete`'s intent, plus an explicit
  "cannot be recovered" clause the way `settings_data_clear_confirm_message`
  already does elsewhere in this app) rather than left English-only. This is
  the same class of gap as `SearchableDropdown`'s "No matches"/"Clear
  selection" (see above).
- **The slot editor's species picker never offers the custom roster as a
  search source** — `legacy-web`'s `PokemonSlot.tsx` has an "Include saved
  custom Pokémon in search" checkbox that merges `customs` into the
  dropdown's options; `phase-2-teams-and-roster.md`'s own "Species picker"
  bullet describes only `PokedexRepository.searchSpecies`-backed search,
  with no mention of the roster at all. Treated as a deliberate scope cut
  by the plan (the bullet is fully specified, not an ambiguous paraphrase),
  not a bug to port — it also sidesteps a real modeling cost: the picker's
  option values would otherwise need to be `PokemonEntry | TeamMember`
  (as they literally are in the TypeScript), forcing a sealed wrapper type
  through `DropdownOption<T>`. "Save as custom" (writing a slot *into* the
  roster) is unaffected and fully implemented; only the reverse direction
  (picking *from* the roster into a slot) is deferred.
- **The ability field is `EditableComboBox` (ported from Hall of
  Memories), not `SearchableDropdown`**, despite
  `native-spec.md`'s "Searchable dropdowns" section listing "ability"
  alongside species/move/generator-anchor as if all four shared one
  contract. `legacy-web`'s actual ability picker,
  `AbilityDropdown.tsx`, is a different component from
  `SearchableDropdown.tsx` entirely: it commits whatever is typed on every
  keystroke (`onChange(val)`) and only *offers* cached abilities as
  clickable shortcuts — never rejecting free text, matching this app's own
  product decision (abilities accept free text, for ROM-hack
  compatibility). That is exactly Hall of Memories' `EditableComboBox`
  contract, so it was copied from there (`docs/plan/README.md`, "Copy Hall
  of Memories, don't invent") rather than force-fitting the strict,
  pick-only-from-a-list `SearchableDropdown` onto a field the behavioural
  reference treats differently.
- **`PokemonType.displayName()` and `DamageClass.displayName()`'s wording
  was verified, not assumed.** `legacy-web` has no full localized type
  names anywhere (its `types.*` i18n keys are three-letter abbreviations
  used for compact badges elsewhere; `PokemonSlot.tsx`'s own type
  `<select>` renders the raw English slug unlocalized) and no localized
  damage-category names at all (`<option value="physical">physical</option>`,
  literal). All 18 Italian type names and the three damage-category names
  were looked up individually against Bulbapedia (an international,
  English-language wiki, cross-referenced to its Italian-wiki
  interlanguage links) rather than recalled from memory and asserted —
  see the `PokemonType.displayName()`/`DamageClassDropdown` commits for
  the full list. "Fisica"/"Speciale"/"Stato" (rather than "Fisico") is a
  minor grammatical judgment call, not a sourced fact: the feminine
  adjective form agreeing with "mossa" ("move"), matching Bulbapedia's own
  "Mossa speciale" phrasing, kept consistent across all three labels.
- **The slot editor's own copy (species placeholder, "Empty slot", "Type
  1"/"Type 2"/"None", "Save as custom"/"Clear slot", the move picker's
  placeholders) has no `legacy-web` i18n coverage at all** —
  `PokemonSlot.tsx` and `MoveSlot.tsx` hardcode every one of these in
  English with no `t()` call. Only `slot.ability` ("Abilità"/"Ability") and
  `teamDetail.pokemonTab`/`analysisTab`/`enableMoves` had a real source to
  port; everything else under `slot_*`/`team_detail_*` is freshly phrased
  to match this app's existing wording style, the same treatment already
  given to `SearchableDropdown` and the Teams screen's dialogs above.
- **Creating a team asks for a name up front**, unlike `legacy-web`'s
  `createEmptyTeam`, which auto-names it `Team ${teams.length + 1}` with no
  prompt at all. This is not a paraphrase disagreement (contrast the
  `MoveSlot` `damageClass` entry above) — `phase-2-teams-and-roster.md`'s
  own "Screens" section explicitly specifies "Create (a name dialog)" as a
  native-only UX decision, so the plan's text is the authority here, not
  `legacy-web`'s code. Creating a team still immediately opens it
  afterward, matching `createEmptyTeam`'s own behaviour.

## Phase 3 — Coverage analysis

- **`offensiveCoverageForMember` keeps its explicit `useMoves: Boolean`
  parameter**, even though `phase-3-analysis.md` §1's own pseudocode lists
  it as `fun offensiveCoverageForMember(chart: TypeChart, m: TeamMember):
  Set<PokemonType>` — no `useMoves` argument at all. The real
  `coverageEngine.ts` signature (`offensiveCoverageForMember(chart,
  member, useMoves)`) has one, every one of its own tests exercises both
  `true` and `false` explicitly, and Phase 4's suggestion engine depends on
  being able to force `useMoves = false` for a candidate regardless of
  what moves it happens to carry ("Candidates are evaluated by types
  only, always" — phase-4's §1 rule 7, and `coverageEngineTest.ts`'s own
  "custom Pokémon type-only evaluation" group, ported verbatim as
  `CoverageEngineTest`'s last case). Dropping the parameter to match the
  plan's abbreviated pseudocode would silently break that. Treated as a
  pseudocode omission, not a signature change to follow.
- **The Pokémon tab's "Analyze team" button and "include custom Pokémon"
  checkbox are deferred to Phase 4**, not built alongside the Analysis
  tab's seven sections. Both exist in `TeamDetailPage.tsx` (next to the
  tab switcher, not inside `CoverageGrid.tsx`), but the button only
  switches to the Analysis tab — already possible by tapping the tab
  itself — and the checkbox toggles `includeCustomsAnalysis`, a flag
  Phase 3's own `AnalysisUiState` carries (per `phase-3-analysis.md` §2's
  explicit instruction to combine it now) but that affects nothing until
  Phase 4's suggestion computation exists. Shipping a checkbox with no
  observable effect would be actively confusing; `AnalysisViewModel`
  already exposes `setIncludeCustomsAnalysis`/`setGenerationFilter` so
  Phase 4's `SuggestionFilters.kt` only needs to add UI, not ViewModel
  plumbing.
- **`MainDispatcherRule` is new** — the first Robolectric test in this
  codebase (or Hall of Memories) to construct a real `ViewModel` and
  collect its `StateFlow` directly, rather than testing only the
  DAO/repository layer underneath it. `viewModelScope` dispatches onto
  `Dispatchers.Main`, which no JVM test provides by default; without
  `Dispatchers.setMain(...)` (and passing that same `TestDispatcher` to
  `runTest`), `AnalysisViewModelTest` hung indefinitely — confirmed by
  reproducing the "did not run to completion" failure before adding the
  rule, not assumed from the symptom. `MainDispatcherRule` lives at the
  test-source root (`app/src/test/java/.../MainDispatcherRule.kt`, no
  package suffix) so any future `ViewModel` test can reuse it.
- **`analysis_pokemon_column_header` and `analysis_suggestions_placeholder`
  have no `legacy-web` source.** `CoverageGrid.tsx`'s "Pokémon" column
  header is a hardcoded literal (`<th>Pokémon</th>`, no `t()`); the
  Suggestions-section placeholder text has no equivalent at all, since
  `legacy-web` never had a partial state where suggestions don't exist
  yet — the phase split is native-only. Same treatment as the other
  wording gaps recorded above. (`analysis_suggestions_placeholder` itself
  is gone as of Phase 4 — the real Suggestions section replaced it.)

## Phase 4 — Suggestions and the Surprise Me generator

- **The generation filter is a real generation number (`Int?`, `null` =
  "all"), not a ported `GenerationFilter` string key.** This is the plan's
  one intentional deviation (`phase-4-suggestions-and-generator.md` §2):
  `suggestionEngine.ts`'s hardcoded `GEN_RANGES` id buckets put every
  alternate form with id > 10000 into "Generation 9" regardless of its
  real species. `domain/suggestion/SuggestionEngine.kt` filters on
  `PokemonEntry.generationIntroduced` directly instead, so `GEN_RANGES`
  has no Kotlin equivalent at all — there was nothing left to port once
  the id-bucket approach was dropped. `TestFixtures.kt`'s `mockPokemonList()`
  proves the fix rather than just asserting it: "Spectraform" (id 9301,
  modelled on a >10000 alt-form id) is deliberately given
  `generationIntroduced = 1`, and `SuggestionEngineTest`'s
  `generation filter uses the real generationIntroduced, not an id range`
  asserts it now appears under the Generation I filter, where the old
  id-range scheme would have excluded it.
- **`computeSuggestions` itself never caps its result**, matching
  `suggestionEngine.ts` exactly (confirmed by porting
  `useSuggestions.test.ts`'s own "top 10 candidates returned (not 5)"
  case, which documents that the *engine* dropped its cap; only
  `SuggestionPanel.tsx` slices to 10 for display). This app's own UI spec
  (`phase-4-suggestions-and-generator.md` §4: "Up to five cards") caps at
  5 instead of the web panel's 10 — `AnalysisScreen.kt` does the slicing
  (`state.suggestions.take(5)`), the same "engine returns everything,
  the screen decides how much to show" split as the TypeScript, just a
  different display count because this phase's own UI spec says so.
- **`Suggestion`/`TeamMember` drop the TypeScript's `spriteUrl` field
  entirely**, for both `memberFromEntry`'s candidates and `Suggestion`
  itself. Every prior phase's `TeamMember` already carries `pokedexId`
  instead of a stored sprite URL — sprite URLs are derived, never stored,
  from `(speciesId, ...)` via `SpriteUrlResolver`/`PokemonSprite`
  (`CLAUDE.md`, "Product decisions already made"); `SuggestionCard.kt`
  resolves a suggestion's sprite from `suggestion.candidate.pokedexId` the
  same way every other screen does, not from a field that would have had
  to be plumbed through and kept in sync for no reason.
- **`teamGenerator.ts`'s `customs: TeamMember[]` parameter is dropped from
  `buildEligiblePool`, `generateTeam` and `regenerateSlot`**, and
  `GeneratorConstraints.customSlots` is kept as a ported struct field but
  is likewise never read by generator logic. Reading `teamGenerator.ts`
  end to end shows `customs` is never referenced in any of the three
  function bodies, and `customSlots` never gates anything either — an
  unfinished feature in the original (the UI still shows a "Custom
  Pokémon" counter when the roster is non-empty, but it does nothing).
  Dropping the dead parameter (not the struct field, which is still part
  of the ported `GeneratorConstraints` shape the UI binds counters to) is
  a straightforward cleanup of something confirmed unused, not a
  behavioural change — see `docs/plan/README.md`'s "when the Kotlin and
  the TypeScript disagree ... the TypeScript is right" rule, which
  governs behaviour, not literal parameter-for-parameter shape.
- **The generator takes an injectable `kotlin.random.Random`** (default
  `Random.Default`), per `phase-4-suggestions-and-generator.md` §3.
  `TeamGeneratorTest`'s ported `teamGenerator.test.ts` "anchor composite
  score validation" case is the clearest payoff: the TypeScript runs
  `generateTeam` five times with real `Math.random()` and accepts 4-of-5
  passes because it has no way to control randomness. The Kotlin version
  asserts the same "no more than one additional Water type" property
  **for every one of ten fixed seeds** (`Random(0)` through `Random(9)`),
  a strictly stronger test of the same claim, run and confirmed green
  locally rather than assumed to hold.
- **`AnalysisViewModel.applySuggestion` writes through the same default-
  ability lookup the slot editor uses** (`pokedexRepository.speciesById(id)
  ?.defaultAbility`, `SlotEditorScreen.kt`'s own pattern for a freshly
  picked species) rather than leaving a newly added/replaced member with
  no ability at all. `memberFromEntry` (the engine's own candidate
  constructor, shared with the generator) deliberately leaves `ability =
  null` — candidates are evaluated by types only, and an ability belongs
  to the *applied* member, not the abstract candidate — so this lookup
  happens once, at the point a suggestion is actually accepted into a
  team slot.
- **Surprise Me is one scrollable screen, not `SurpriseMeModal.tsx`'s
  three-step (seed/constraints/result) wizard.** The phase's own UI
  section asks only for "an optional anchor picker ..., the constraint
  controls, a Generate button, per-slot regenerate, and Keep ... styled
  to match the rest of this app's Material 3 screens" and explicitly
  notes the web modal was never Android-restyled, so there was no native
  pattern to preserve continuity with. Every other destination in this
  app is a full screen, not a dialog/wizard; collapsing the three steps
  into one scrollable column (anchors → constraints → Generate → result)
  keeps that consistent rather than introducing the only multi-step
  wizard in the app.
- **"Keep" always creates a brand-new team**, via `TeamRepository.createTeam`
  followed by six `saveMember` calls, rather than offering to overwrite an
  existing one — matching `useAppShell.ts`'s `handleSurpriseCreate` (the
  handler `App.tsx` wires to `SurpriseMeModal`'s `onCreate`), which also
  always appends a brand-new `Team` to `state.teams`; there is no
  "overwrite an existing team" path in the behavioural reference either.
  One real difference: `handleSurpriseCreate` auto-names the team
  (`` `Team ${state.teams.length + 1}` ``) with no prompt, while Keep here
  reuses `TeamNameDialog` (the same name-entry dialog Teams' own "create"
  flow uses) to ask first — consistent with Phase 2's own "creating a team
  asks for a name up front" decision (see above), which already treats
  `phase-2-teams-and-roster.md`'s explicit "a name dialog" instruction as
  the native-only authority over `legacy-web`'s auto-naming.

## Phase 5 — Showdown import/export, settings and local backup

- **The Showdown parser's resolver callbacks take the full `PokemonEntry`/
  `MoveEntry`, not just a species' types or a move's fields**, unlike
  `showdownParser.ts`'s `resolveTypes: (name) => [PokemonType,
  PokemonType | null] | null`. This app resolves a sprite from
  `TeamMember.pokedexId`, never a stored URL (every prior phase's
  `TeamMember` already carries that instead of `spriteUrl`) — the id has
  to come back from resolution somehow, and threading it through a
  parallel second lookup (as `ImportExport.tsx`'s own caller does, via a
  second `pokemon.find()` after parsing) would just be more code for the
  same result. `PokedexRepository` gained `allMoves()` (mirroring
  `allSpecies()`) instead of a per-move `moveByName` specifically so the
  import screen can resolve every line in a pasted team from one bulk
  fetch, not a suspend call per move.
- **Import always creates a brand-new team, prompting for its name up
  front** — the same shape as Surprise Me's Keep (see above), and for the
  same reason: `phase-2-teams-and-roster.md`'s "a name dialog" instruction
  is the native-only authority here, and `useAppShell.ts`'s own
  `handleImportTeam` (the live, reachable import path — wired from
  `App.tsx`) also always appends a new `Team`, never overwrites one.
  `legacy-web/src/components/ImportExport/ImportExport.tsx`, which *does*
  write into a specific existing team's slots, is dead code — grepping the
  repo shows nothing renders it; `useAppShell.ts`'s `handleImportTeam` is
  the actual behavioural reference, not that component.
- **Export lives only on a team's overflow menu; Import lives only in
  Settings** — not both places for both actions, despite
  `phase-5-import-export-and-settings.md` §2's "both in Settings and both
  reachable from a team's overflow menu" phrasing. Export needs a specific
  team to render (there is nothing to export from Settings without first
  picking one, and Teams' own overflow menu already exists for per-team
  actions); Import always produces a *new* team per the decision above, so
  it has no natural per-team entry point — attaching an "Import" action to
  an existing team's menu would misleadingly suggest it imports *into*
  that team. One entry point per action, at the place each one's own
  target (an existing team vs. a new one) actually lives.
- **`ThemePreferences` is renamed to `SettingsPreferences`.** It now holds
  `includeMegaDynamax`/`excludeLegendaries`/`includeCustomsAnalysis`
  alongside the Phase 0/3 theme and `showMoves` keys, in the same
  `settings_prefs` DataStore file as always (`phase-5-import-export-and-
  settings.md` §3: "one file, not five") — the old name stopped describing
  what the class actually holds partway through Phase 3 already.
- **`excludeLegendaries` and `includeMegaDynamax` moved out of
  `AnalysisViewModel`'s per-screen state into `SettingsPreferences`**,
  removing the "exclude legendaries" switch `SuggestionFilters.kt` shipped
  with in Phase 4. Rereading `TeamDetailPage.tsx`'s props for this phase
  showed neither has an `onChange` callback there — both are read-only,
  app-wide preferences flowing down from `AppSettings`, unlike
  `includeCustomsAnalysis`, which does have one (see the next entry). The
  Phase 4 per-screen toggle was a reasonable interim shape before
  `SettingsPreferences` existed to back it; once it did, keeping a
  duplicate, ephemeral copy of a setting the reference implementation
  treats as global would just invite the two from drifting apart.
- **`includeCustomsAnalysis` stays a toggle on the Analysis screen, but is
  now backed by `SettingsPreferences` too** — reconciling two phase docs
  that describe it differently. `phase-3-analysis.md` calls it one of
  "the local toggles" `AnalysisViewModel` combines; `phase-5-import-
  export-and-settings.md` §3's table lists it as
  `SettingsPreferences.includeCustomsAnalysis` under the same "one
  DataStore file" rule as the other settings. `TeamDetailPage.tsx` itself
  splits the difference: it receives `includeCustomsAnalysis` as a prop
  *with* an `onIncludeCustomsChange` callback, unlike the two read-only
  ones above — genuinely page-adjustable in the reference implementation,
  just not (per `types/index.ts`'s `AppSettings` interface, which has no
  such field at all) actually persisted there. Keeping the on-screen
  toggle satisfies Phase 3's description; persisting it satisfies Phase
  5's; doing both is a strict improvement over the TypeScript, which
  forgets the choice the moment you leave the page.
- **The local backup has no `images/` entries**, unlike Hall of Memories'
  own `BackupArchive.kt`, which this file otherwise copies wholesale
  (`phase-5-import-export-and-settings.md` §4: "Copy Hall of Memories'
  `data/backup/` wholesale"). CoverDex has nothing analogous to a
  screenshot or box art — every field on a `TeamMember`/`Team` is already
  plain data — so the `ImageStorage`-driven half of the reference
  implementation (`BackupArchiveBuilder`'s referenced-file-name filtering,
  `importPayload`'s `resolveImage`) has nothing to port; the zip holds
  only `data.json`.
- **A restored custom roster entry's `createdAtEpochMillis` is
  synthesized from its position in the backup, not carried over from the
  original row.** `CustomPokemonRepository.roster: Flow<List<TeamMember>>`
  already discards that column when mapping `CustomPokemonWithMoves` to
  the domain `TeamMember` — it exists purely as `observeRoster()`'s
  `ORDER BY` key, never a value any screen displays — so `BackupPayload`
  (built from the domain model, like Hall of Memories' own DTOs) never
  had it to preserve in the first place. `BackupRepositoryImpl.importPayload`
  assigns each entry `restoreTimeBase + index` instead, which reproduces
  the one thing the real timestamp was ever for: the roster's display
  order survives a restore intact, even though the literal historical
  creation instant does not — the actual invariant behind "timestamps
  preserved" (`phase-5-import-export-and-settings.md` §4), not a
  narrower literal reading of it that this app's own architecture can't
  satisfy for this one field.
- **Timestamps in the backup format are epoch-millis `Long`s, not ISO
  strings** (`BackupPayload.exportedAtEpochMillis`), matching every other
  timestamp already in this app (`Team.createdAtEpochMillis`,
  `CacheStatus.syncedAtEpochMillis`) rather than Hall of Memories'
  `java.time.Instant.toString()` — `minSdk` stays 24
  (`docs/plan/native-spec.md`, "Identity") and `java.time` needs API 26
  without desugaring, the same reason `PokedexRepositoryImpl` already
  uses `java.text.SimpleDateFormat` instead.

## Phase 6 — Release

- **The release keystore was not generated by this agent, and never will
  be.** `docs/release-signing.md` documents the `keytool -genkeypair`
  command and the five GitHub secrets the workflows need
  (`RELEASE_KEYSTORE_BASE64`, `RELEASE_KEYSTORE_PASSWORD`,
  `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`, `RELEASE_PUSH_TOKEN`), but
  generating the actual key material and setting repository secrets on
  someone else's behalf is outside what an agent session can safely do —
  it has no durable, private place to hold a signing key between
  sessions, and no business writing secrets into a human's repository
  without them typing the values in themselves. `app/build.gradle.kts`'s
  `signingConfigs["release"]` (wired in Phase 0) already falls back to an
  unsigned build when the four keystore env vars are absent, so this is a
  deliberate, permanent stopping point for the agent's part of the work,
  not a missed step.
- **`build-apk.yml` and `release.yml` were copied from Hall of Memories
  and adapted, not designed from scratch** — same secret names, same
  base64-decode-and-verify-integrity step, same `signingReport` sanity
  check. `release.yml` additionally cuts `CHANGELOG.md`'s `[Unreleased]`
  section into a dated release section and bumps `versionCode`/
  `versionName` in `app/build.gradle.kts`, pushing that bump back to
  `main` with a `RELEASE_PUSH_TOKEN` PAT so the commit isn't blocked by
  branch protection on the workflow's own default `GITHUB_TOKEN`. Both
  files were validated with `python3 -c "import yaml; yaml.safe_load(...)"`
  before being committed — this repo has no GitHub Actions runner
  available in-session to actually execute them.
- **`legacy-web/` was deleted only after checking every item its own
  `CLAUDE.md` bullet named as needing a native equivalent**: the coverage
  engine (`coverageEngine.ts` → `domain/coverage/CoverageEngine.kt`,
  36 ported test cases), ability effects (`abilityEffects.ts` →
  `domain/ability/AbilityEffects.kt`, checked line-for-line — same
  eleven immunities, the same two `thick-fat`/`fluffy` multipliers, the
  same `wonder-guard` badge note), the suggestion engine and its
  composite-score weights (`suggestionEngine.ts` →
  `domain/suggestion/`, the `0.5`/`1.0` weights confirmed byte-identical
  in both files), the team generator and `STARTER_FINALS`
  (`teamGenerator.ts` → `domain/generator/TeamGenerator.kt`), the
  Showdown format (`showdownParser.ts` → `domain/showdown/
  ShowdownFormat.kt`, 19 ported tests), and both locale files
  (`i18n/locales/{it,en}.json`, 142 flat keys each) against
  `res/values{,-en}/strings.xml` (173 keys each, a superset — the extra
  keys are native-only screens with no PWA equivalent, e.g. the
  navigation drawer). `docs/plan/` itself was kept, deliberately, as the
  historical record of how the rewrite was built and reasoned about —
  nothing in `CLAUDE.md` or `native-spec.md` ever asked for that to be
  deleted, only `legacy-web/`.
- **`README.md`, `ROADMAP.md` and `.github/CONTRIBUTING.md` were rewritten
  rather than patched.** All three were still written for the PWA-and-
  native dual-release era of the project (npm commands, GitHub Pages,
  Capacitor); patching individual sentences would have left the overall
  framing wrong even with every literal inaccuracy fixed. `CHANGELOG.md`'s
  `[Unreleased]` section was cut into a real `## [2.0.0]` release entry
  with its bullets reordered so the data-loss warning (saved teams do not
  carry over from the Capacitor build) appears third, immediately after
  the two purely positive "it's native now" bullets — stated plainly
  rather than softened, per `docs/plan/native-spec.md`'s own instruction
  that "Phase 6's release notes must lead with that warning."

## Post-migration review

Findings from `docs/post-migration-review.md`, a code-level audit run
after Phase 6 closed. Each finding below records the decision made when
fixing it; the review document itself has the full analysis, including
findings not yet acted on.

- **Finding 1 (crash) — fixed as a pure bug fix, no decision needed.**
  `regenerateSlot`'s ranking recomputed its composite score (including
  random tie-breaking noise) inside the sort comparator instead of once
  per candidate, which could throw `IllegalArgumentException` once the
  eligible pool was large. The production pool is in the high hundreds;
  every existing test pool was under 20 entries, which is why nothing
  caught it. Fixed by scoring once per candidate before sorting.
- **Finding 5 (Surprise Me's "Custom slots" stepper did nothing) —
  implemented rather than removed.** `teamGenerator.ts` accepted a
  `customs: TeamMember[]` parameter it never referenced, and Phase 4's
  port dropped it as genuinely dead — but kept
  `GeneratorConstraints.customSlots` as a ported struct field, so the
  Surprise Me screen shipped a stepper that consumed the six-slot budget
  and placed nothing. Decided to implement rather than delete the
  stepper: it is the one generator feature that serves this app's stated
  ROM-hack/draft-building audience (`CLAUDE.md`, "What this project
  is"), and `SurpriseMeViewModel` already loaded the custom roster into
  its UI state without using it. `generateTeam` and `regenerateSlot` now
  take a `customs: List<TeamMember> = emptyList()` parameter (default
  keeps every pre-existing call site, including every test, unchanged)
  and treat `customSlots` as a reserved category exactly like starter/
  legendary-mythical/Mega/Dynamax — with one asymmetry, stated here
  because nothing forced it either way: a custom is **never** chosen
  opportunistically in an unconstrained "free" slot the way a catalogue
  Pokémon can be once its own quota is met, because customs live outside
  `buildEligiblePool`'s catalogue-only pool. A custom appears only while
  its own reserved budget still has room. The alternative (customs
  competing for every free slot too) was rejected as surprising: a user
  who sets `customSlots = 0` should never see a custom Pokémon appear.
- **Finding 2 (both engines ran on the main thread) — no injected test
  dispatcher.** `AnalysisViewModel`'s `combine()` chain now ends in
  `.flowOn(Dispatchers.Default).stateIn(...)`; `SurpriseMeViewModel.
  generate()`/`regenerateSlot()` now do `isGenerating.value = true`
  synchronously, then `viewModelScope.launch(Dispatchers.Default) { ...
  }` for the whole computation and every `result`/`warning`/
  `isGenerating` write — deliberately not `withContext(Dispatchers.
  Default) { compute() }` followed by writes back on the launch's
  original (Main) context, which would need a second hop back through
  `Dispatchers.Main` after the background work finishes. Considered
  adding an injectable `@DefaultDispatcher` qualifier to
  `CoroutinesModule.kt` (the established pattern for cross-cutting
  coroutine concerns here, see `@ApplicationScope`) so tests could
  substitute a deterministic `TestDispatcher`; decided against it for
  now; `Dispatchers.Default` is hardcoded, matching this codebase's
  existing convention of calling `Dispatchers.IO` directly in
  `data/pokeapi`/`data/backup` rather than injecting a dispatcher there
  either. `SurpriseMeViewModel`'s synchronous `isGenerating.value = true`
  before the launch is why this is safe to test without one: a test can
  assert on `vm.uiState.value.isGenerating` immediately after calling
  `generate()`, with no suspension needed, and the eventual `false` is
  observed via a real `StateFlow` update from a real background thread —
  not virtual time — the same category of wait every Room-/DataStore-
  backed test in this codebase already relies on.
- **Finding 3 (per-candidate rework in `computeCompositeScore`) —
  `TeamScoringContext` extracted, no new test.** `computeCompositeScore`
  took `otherMembers: List<TeamMember>` and rebuilt the offensive
  coverage union and weakness map from it on every call, even though
  neither depends on the candidate — only on the team. Extracted that
  half into `teamScoringContext(chart, otherMembers): TeamScoringContext`,
  built once per distinct team (once in addition mode, once per
  replacement candidate — six total, not `candidates × 6`) and passed
  into `computeCompositeScore` in place of the raw member list.
  `TeamGenerator.computeScore` additionally reused the context's
  `baseCoverage` as its own `currentTeamCoverage` argument, deleting a
  second, independent redundant computation of the exact same set that
  existed only in that one call site (the generator never excludes a
  member from the comparison the way the suggestion engine's replacement
  mode does, so building the context from the exact team scored against
  makes the two values identical — this does **not** hold for the
  suggestion engine, where `currentTeamCoverage` is `analyseTeam`'s
  potentially moves-aware `unionCovered`, deliberately different from
  the context's always-types-only `baseCoverage`). No new test: this is
  behaviour-preserving by construction (same inputs, same output shape,
  work reordered not changed), and every call site funnels through
  `computeSuggestions`/`generateTeam`/`regenerateSlot`, all three already
  covered by `SuggestionEngineTest`/`TeamGeneratorTest`'s existing exact-
  score and exact-ranking assertions.
- **Finding 4 (Suggestions panel "missing" PWA features) — the original
  finding was wrong, corrected before implementing it.** As first
  written, finding 4 claimed the Suggestions panel was missing a
  type-filter chip row, a "Best coverage"/"Random" mode toggle, and
  showed 5 cards where the PWA showed 10 — based on a diff against
  `SuggestionPanel.android.tsx`/`SuggestionFilters.android.tsx` alone.
  `docs/plan/native-spec.md`'s "Suggestion engine" section states "Return
  the top 5 by `gain`" for both addition and replacement mode, and
  mentions neither the type filter nor the mode toggle;
  `SuggestionFilters.kt`'s own doc comment already said as much
  ("Deliberately smaller than `legacy-web`'s own `SuggestionFilters.tsx`
  [...]: neither is in this app's UI spec") — a comment the original
  review should have read before writing that table and didn't. Five
  cards is the spec for this rewrite, not a shortfall against the PWA;
  implementing the retracted items would have reversed a documented
  Phase 4 decision. What survived the correction: a `solidCoverage`
  message (independent of the retracted items — shown when every
  displayed suggestion has zero gain, regardless of how many are shown or
  how they got filtered) and deleting one genuinely orphaned string
  resource (`suggestions_exclude_legendaries`). See the corrected finding
  4 in `docs/post-migration-review.md` for the full record, including the
  quoted spec text.
- **Finding 6 (abilities ignored by suggestion/generator scoring) —
  `weaknesses()` gained an `ability` parameter, a real spec change.**
  `weaknesses(chart, types)` never took an ability, unlike
  `sharedWeaknessCounts`/`defensiveProfile` in `CoverageEngine.kt`, which
  always honoured it — so a team's Analysis screen could show a member
  as immune to a type (via the coverage grid) while the Suggestions
  section, on the same screen, still penalized a candidate for
  "aggravating" that exact weakness. Added `ability: String? = null` to
  `weaknesses()`, threaded `candidate.ability` and each `otherMembers`
  member's `.ability` through `computeCompositeScore`/
  `teamScoringContext`. Also fixed `memberFromEntry` (dropped from Phase
  4 as `ability = null` for every catalogue-derived candidate) to carry
  `PokemonEntry.defaultAbility`, so a candidate is scored with the
  ability it will actually have once applied, not always with none —
  this let `TeamGenerator.Candidate` drop its own separate `ability`
  field entirely (both construction paths already produce a `member`
  whose own `ability` is correct, so the "pick the ability to apply"
  step this field existed for is a no-op now). This *is* a spec change:
  composite scores now differ from the ported TypeScript baseline for
  any candidate or team member with a scoring-relevant ability (the 14
  entries in `AbilityEffects.kt`'s `ABILITY_EFFECTS`). Every existing
  fixture in `TestFixtures.kt`/`SuggestionEngineTest.kt`/
  `TeamGeneratorTest.kt` has `defaultAbility = null` and builds every
  `TeamMember` with no explicit `ability` either, so this change is
  invisible to every existing exact-score/exact-ranking assertion — a
  new `ScoringTest.kt` exercises the new behavior directly (Levitate
  removing a candidate's own Ground weakness; a teammate's Levitate
  changing a shared candidate weakness from "aggravated" to merely
  "new").

## Phase 7 — Engine accuracy, abilities/items, BST ranking

- **BST is the suggestion ranking's tie-break only, never a term in the
  composite score.** Discussed explicitly with the repository owner
  before implementation: making a candidate's raw strength part of the
  score itself would change what "the best pick" means for a team that
  is *not* yet solid (a real coverage gain could be outranked by a
  bigger Pokémon with no gain at all), and would touch the `0.5`/`1.0`
  weights `Scoring.kt`'s own doc comment calls "load-bearing and shared
  with the generator". The comparator instead adds exactly one new step
  — `bestScore, then isFinal, then baseStatTotal descending, then
  catalogue id ascending` — so it only ever decides among candidates that
  already tied on real coverage/weakness math.
- **Held items are the defensive subset only, and `items.csv` is never
  downloaded.** Also an explicit decision with the repository owner:
  modelling every item (offensive boosts, berries with non-type effects,
  weather items) would need the full item catalogue (a further ~60 KB)
  for a coverage app that only cares about type effectiveness. The 18
  modelled items (Air Balloon, Iron Ball, Ring Target, one resist berry
  per type) are a hardcoded table, the same shape as `ABILITY_EFFECTS`.
  **The plan document's own §4.1 table has a gap** — it lists 16 resist
  berries plus Chilan and omits Coba Berry (Flying) — caught during
  implementation by cross-checking "one berry per type except Normal"
  against `PokemonType.entries`; `ItemEffects.kt`'s `ITEM_EFFECTS` map is
  the correct, complete 18-item version and a dedicated test
  (`ITEM_EFFECTS has one resist berry per type except Normal, plus
  Chilan for Normal`) asserts the full set going forward.
- **The item field has no canonical-per-species picker, unlike ability.**
  `AbilityPicker`'s canonical/custom split exists because a species'
  abilities are a small, fixed, PokéAPI-known set; any Pokémon can hold
  any item, so there is no equivalent "canonical list" to offer —
  `ItemPicker` is free text with suggestions from the modelled subset
  only, the same shape as the ability field's own custom mode.
- **`AbilityPicker`'s free-text suggestion list does not show the
  "has an effect" marker that the canonical dropdown does.**
  `EditableComboBox` commits whatever suggestion string the user taps
  verbatim as the field's value — appending a marker (e.g. "Overgrow ●")
  to a suggestion would corrupt the stored ability with that marker
  attached. The canonical dropdown avoids this because its `onClick`
  commits `ability.displayName` independently of the `Text` content
  shown in the row; the free-text list has no such separation available
  without changing `EditableComboBox`'s own contract, which several
  other screens already depend on. Scope decision: the badge only
  appears on canonical picks.
- **`KNOWN_ABILITIES_WITH_EFFECTS` is regenerated from `ABILITY_EFFECTS`
  instead of hand-maintained, and its exact strings changed as a result.**
  Before Phase 7 it was a hand-tweaked list with one inconsistency of its
  own ("well-baked body", replacing only the *second* hyphen in
  `well-baked-body` with a space, keeping the first) — a leftover, unused
  artifact from the `legacy-web` port that nothing in the app actually
  reads (confirmed by grep before touching it). It's now
  `ABILITY_EFFECTS.keys.map { it.replace('-', ' ') }`, so `well-baked-body`
  becomes "well baked body" (both hyphens replaced) rather than the old
  mixed convention. Harmless: nothing consumes this constant, and its own
  test was rewritten to assert the regenerated shape, not the old one.
- **Wonder Guard was promoted from `AbilityEffect.BadgeOnly` to a real
  effect (`OnlySuperEffective`), not left as a display note.** The
  pre-Phase-7 table treated it as UI-only, so `defensiveProfile`/
  `defensiveMultiplier` were actively wrong for the one Pokémon (Shedinja)
  the ability applies to: a resisted or neutral hit should deal zero
  damage, but the engine reported the real chart multiplier instead. This
  is a genuine behavior change (a Wonder Guard holder's non-neutral
  matchups now show up in `defensiveProfile.immunities`, not scattered
  across weaknesses/resistances), found by auditing `ABILITY_EFFECTS`
  against PokéAPI's own `short_effect` text rather than assumed.
- **Gen I's canonical BST is the sum of five stats, not six** — no
  Special Attack/Special Defense split existed before Generation II, so
  mirroring the single "Special" stat into both halves (making a false
  six-stat total) would inflate every Gen-I Pokémon's total and change
  relative ordering among special-heavy species. `bstResolverFor`/
  `assembleDataset`'s `bstAt` both apply this rule, and it is the reason
  a Gen-I total must never be compared numerically against a later
  generation's — documented on `PastBst` itself since it is the one way
  this feature can go quietly wrong.
- **`SuggestionEngine.EntryLookup`'s displayName-first precedence can, in
  a contrived case, disagree with the pre-Phase-7 single-pass
  `pool.find { it.displayName == x || it.name == x.lowercase() }`** — if
  one entry's raw identifier lowercased happens to equal another entry's
  exact display name, the old code (which evaluates both conditions per
  pool element, first match wins by *pool position*) could return a
  different entry than the new two-map lookup (which always checks
  *every* displayName match before falling back to *any* name match,
  regardless of position). This divergence needs a contrived, unrealistic
  fixture to observe — real `displayName`/`name` pairs never collide this
  way — and the plan's own §5.4 explicitly frames "displayName match
  first" as the behavior to preserve, so the two-map version is the
  intended, not merely tolerated, semantics.

## Showdown format compatibility (post-Phase 7)

- **`parseShowdownBlock` mistook any unrecognized line for a new species
  line, not just the block's first one.** Verified against the real
  client's own grammar (`sim/teams.ts` in smogon/pokemon-showdown,
  `exportSet`/`parseExportedTeamLine`): a genuine Showdown export commonly
  includes `Level:`, `Shiny: Yes`, `Tera Type:`, `Happiness:`,
  `Pokeball:`, `Hidden Power:`, `Dynamax Level:` and `Gigantamax: Yes`
  lines, none of which this app tracks — but the old `when` block's final
  branch (`!line.startsWith("#")`) treated *every* line that wasn't a
  move, an `Ability:` line, or an EVs/IVs/Nature line as a fresh species
  line, silently overwriting whatever had already been parsed. Pasting
  almost any real-world set with a `Level:` or (very common in Gen 9)
  `Tera Type:` line therefore corrupted `speciesName` to that line's text
  and broke species resolution. Fixed by tracking each line's position
  (`forEachIndexed`) and only ever treating index 0 as the species line —
  the same `isFirstLine` split the real client's own parser uses — with
  every other unrecognized line now silently ignored instead of
  overwriting anything, and an explicit ignore-list for the ten field
  prefixes above.
- **The species line now also strips a nickname wrapper and a trailing
  gender marker**, e.g. `Volt Turtle (Pikachu) @ Light Ball` or
  `Pikachu (F) @ Light Ball` — both common in real pastes (nicknamed
  Pokémon, VGC sets with explicit gender) and previously left whole,
  which meant `resolveSpecies` was called with a string that could never
  match a real species name. Same order of operations as the real
  client's `parseExportedTeamLine`: split the item off first, then strip
  `" (M)"`/`" (F)"`, then unwrap `"Name (Species)"`.
- **`Trait: <ability>` is now accepted as a legacy alias for
  `Ability: <ability>`** — the real client still parses it (pre-Gen-6
  sets, and some third-party tools, still emit it) and previously it fell
  into the same species-line bug above.
- **The exporter no longer writes blank `Ability:`/`EVs:`/`Nature`
  placeholder lines, or a bare trailing `@ ` with no item.** These were
  only ever safe to re-import because CoverDex's own parser explicitly
  ignored them and the real client's line-matching happens to fail too
  once each line is `.trim()`-med (`"EVs: "` trimmed no longer starts
  with the 5-character prefix `"EVs: "`) — accidentally harmless, not
  correct. Real Showdown's own `exportSet` omits a field's line entirely
  when it's unset (`if (set.ability) …`, `if (stats.length) …`), so the
  exporter now does the same: `Ability:` is only written when
  `TeamMember.ability` is non-null, and EVs/IVs/Nature are omitted
  outright since they are still untracked (out of scope — see
  `docs/plan/native-spec.md`, "Explicitly out of scope", "EV/IV
  tracking"). Existing tests asserting the old blank-line shape were
  updated to assert the lines are absent instead.
- **The `# Types: fire/flying` comment line is intentionally left as
  CoverDex's own extension.** Confirmed against the real parser that any
  line not matching a known prefix (species/`Ability:`/`Trait:`/EVs:`/
  `IVs:`/nature/moves/the eight ignored-detail prefixes) is silently
  skipped, never erroring or corrupting a later field — so this
  round-trips through the real client untouched, and through CoverDex's
  own parser as the type-override signal it always was.

## New app icon

The launcher icon carried over from the Capacitor build (see "The launcher
icon is a verbatim copy..." above) was replaced with new, purpose-made
artwork — a red Pokédex-style handheld next to a notepad and pencil,
supplied as a single flattened 1254×1254 raster (art + solid blue
background baked into one image, not separate foreground/background
layers).

The sibling repo HackDex-Tracker shipped this exact kind of asset once
before and got it wrong: it treated a full-bleed raster as automatically
exempt from adaptive-icon masking just because the foreground layer was
transparent, and it wasn't — every launcher clips an `<adaptive-icon>`'s
*composite* to its own mask shape (circle, squircle, rounded square, ...)
regardless of which layer the visible art sits in, and real devices cut
straight through that badge's artwork before it was fixed (see that
repo's `docs/implementation-decisions.md`, "Adaptive icon safe zone").
Rather than repeat that mistake, this asset was scaled and padded
*before* ever reaching a device:

1. Sample the source image's background color from its border pixels
   (a uniform blue, `rgb(25, 129, 238)` give or take JPEG-ish noise).
2. Find the farthest pixel from center that differs meaningfully from
   that background color — the true visual extent of the artwork, not
   just its bounding box.
3. Compute the scale factor that brings that farthest pixel to just
   inside Android's documented safe zone: a circle 66dp in diameter,
   centered in the 108dp adaptive-icon canvas
   (<https://developer.android.com/develop/ui/views/launch/icon_design_adaptive>) —
   with a small margin so the result sits just inside that guarantee
   rather than exactly on its edge.
4. Resize the *entire* source image (art and background together) by
   that factor and center it on a same-size canvas filled with the same
   background color — since the fill color matches the source's own
   background exactly, there is no visible seam.
5. Verify by simulating the 66dp/108dp circular mask over the result and
   confirming zero pixels outside it differ from the background color.

`ic_launcher_background.png` is this composited, verified image at every
density (`mdpi` 108px through `xxxhdpi` 432px); `ic_launcher.xml`/
`ic_launcher_round.xml` set the foreground to `@android:color/transparent`
and no longer reference an `ic_launcher_foreground.png` (deleted — there
is no separate foreground art to inset). The legacy pre-API-26
`ic_launcher.png` is the same composited image at the legacy sizes;
`ic_launcher_round.png` is the same again masked to a circle inscribed in
the square, matching how the previous icon's round variant was built.
Verified with the same circular/squircle/rounded-square mask simulation
technique as HackDex-Tracker's fix, confirming the artwork survives every
shape uncropped before this ever reached a real device.
