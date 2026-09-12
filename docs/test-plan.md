# Test plan

Manual, on-device verification for the native Android migration
(`docs/plan/`). Automated tests (`./gradlew testDebugUnitTest`) cover pure
logic and Robolectric-testable Room/DataStore code; this file covers
everything that genuinely needs a real device or emulator — the real
network, locale switching, image rendering, file pickers — plus one
"Known regressions" entry per real bug a manual pass actually found.

One new section per phase, added in the same PR that ships the phase.

## Phase 0 — Foundation

- [ ] **Fresh install.** Uninstall any existing CoverDex build, install the
  debug APK. App launches without crashing, shows the Teams screen with its
  empty state (title + subtitle, no crash, no infinite spinner).
- [ ] **Upgrade over the old Capacitor build**, if a device still has it
  installed. The native APK (same `applicationId`,
  `com.marcogn.coverdex`) installs as an *update*, not a fresh install
  prompt, and launches straight into the new native UI. (No data carries
  over — see `docs/implementation-decisions.md`; this step only confirms
  the install itself succeeds, since the two builds' signing keys must
  eventually match for this to work at all once Phase 6 signs a release —
  covered again there.)
- [ ] **Drawer navigation.** Open the drawer (hamburger icon), confirm all
  three items are present (Your Teams / Custom Pokémon / Settings) and each
  one navigates to its screen. Re-opening the drawer and tapping the
  already-open screen's item does not push a duplicate back-stack entry
  (back from Roster after Teams → Roster → Settings → Roster should return
  to the app's previous screen, not silently re-enter Roster twice).
- [ ] **Theme picker.** Settings → Appearance: switching between System /
  Light / Dark actually changes the app's colours immediately. Force-close
  and reopen the app — the chosen theme is still applied (not reset to
  System).
- [ ] **Language picker.** Settings → Language: switching to Italiano/
  Italian and English changes every visible string on every screen (drawer
  labels, screen titles, empty-state text, the Settings screen's own
  labels) — not just the screen you were on when you switched. Force-close
  and reopen the app — the chosen language is still applied. Switching to
  "System default" follows the device's own language.
- [ ] **Dynamic colour (API 31+ device/emulator only).** With Material You
  wallpaper-based colour enabled at the OS level, the app's colour scheme
  follows the wallpaper instead of the seeded brand purple. On an
  API ≤ 30 device or with dynamic colour unavailable, the app falls back
  to the seeded purple scheme (`#5B21B6`-derived) without crashing.
- [ ] **Launcher icon.** Home screen and app switcher show the new icon
  (red handheld + notepad on a blue background) at every density the
  device renders it at, fully uncropped under adaptive-icon masking
  (circle/squircle/rounded square/etc.) — see
  `docs/implementation-decisions.md`, "New app icon" for how the safe
  zone was verified before this manual check.
- [ ] **Dark mode + edge-to-edge.** With the system in dark mode and gesture
  navigation, the status bar and navigation bar are transparent and the
  content isn't obscured by either.

### Known regressions

None yet.

## Phase 1 — Dataset sync

- [ ] **First launch sync.** Fresh install, no cache. Open the app — the
  Teams screen's sync banner appears (a short "Syncing Pokémon data…" line
  with a progress bar) and disappears within a few seconds on a normal
  connection, without ever blocking the empty state underneath it. This is
  the whole point of the phase — confirm it's actually fast, not just that
  it works.
- [ ] **Settings → Data, first launch.** Before the sync finishes: shows
  "Data not downloaded yet." After it finishes: shows the real species/move
  counts (should read 1351 Pokémon, 919 moves against the pinned revision —
  see `docs/implementation-decisions.md` for why 919, not 937), a synced-at
  timestamp in the device's own locale/format, and the short dataset
  revision (`d4f9a4a`).
- [ ] **Sync now.** Settings → Data → "Riscarica dati Pokémon"/"Redownload
  Pokémon data" re-syncs even though the cache is already fresh (confirm
  the synced-at timestamp actually updates), without disturbing anything
  else.
- [ ] **Clear cached data.** Tap "Cancella dati salvati"/"Clear cached
  data", confirm the dialog, confirm the cache reports "not downloaded yet"
  immediately after. Reopen Teams — the sync banner reappears and re-syncs
  on its own (no manual re-sync needed).
- [ ] **Offline first launch.** Turn off network before first launch (or
  after clearing cache). The sync banner shows briefly, Settings → Data
  reports the failure with the real underlying reason (not a generic
  message) and a "Riprova"/"Retry" button. Nothing else in the app is
  blocked or crashes. Turning network back on and tapping Retry succeeds.
- [ ] **Language switch mid-sync-display.** With Settings → Data showing a
  synced summary, switch language — the section title, summary sentence
  (singular "1 mossa"/"1 move" vs plural, if you can catch a build with
  exactly 1 move — otherwise just confirm the plural form reads
  correctly for the real count) and both button labels switch immediately.

### Known regressions

None yet.

## Phase 2 — Teams, slots and the custom roster

- [ ] **Create, rename, delete a team.** Teams screen's FAB opens a name
  dialog (Confirm disabled while blank); the new team opens immediately.
  Three-dot menu on a team row → Rename (pre-filled with the current name)
  and Delete (a confirmation dialog naming the team) both work and neither
  disturbs the other teams' order in the list.
  [ ] **Order survives a rename.** With three or more teams, rename one
  in the middle of the list — it must not jump to the end.
- [ ] **The slot editor's species picker.** Open any slot, type a partial
  species name — matches appear only after the first character (no list
  on focus alone), picking one fills the sprite, both type badges and the
  default ability. Picking a *different* species afterward fully replaces
  the slot (old moves/ability gone), not merged with the previous pick.
- [ ] **Type overrides persist independently per slot.** Change Type 1
  and/or Type 2 on one slot, save, reopen it — the override is still
  there; a different slot with the same species is unaffected.
- [ ] **Ability field accepts free text.** Type an ability that isn't in
  the suggestion list at all (a ROM-hack-only ability name), save, reopen
  the slot — the typed text is preserved verbatim, not rejected or
  cleared.
- [ ] **"Enable move slots" toggle** shows/hides the four move rows on
  every slot editor and on the roster editor alike (it's one shared,
  global setting) and survives an app restart.
- [ ] **A custom move's defaults.** In a move slot, type a name with no
  cache match into the "Custom move name" field (leave the picker above
  it untouched) — the type/power/category fields that appear default to
  Normal / blank / Physical, per `docs/implementation-decisions.md`
  ("Phase 2"), not Status.
- [ ] **"Save as custom" from a slot** adds the slot's current Pokémon to
  the custom roster (check the Custom Pokémon screen) without altering
  the team slot itself.
- [ ] **Back discards unsaved edits, on every path.** Open a slot, change
  several fields, then back out via (a) the top bar's arrow, (b) the
  system back gesture — reopen the slot both times: nothing was saved.
  Only the checkmark (Save) action commits.
- [ ] **Custom roster CRUD.** Add an entry (name required — Save disabled
  while blank), edit an existing one (tap its row), delete it (its own
  icon button, no confirmation prompt). Deleting one entry never affects
  the others' sort order.
- [ ] **Wiping the Pokédex cache leaves every team and roster entry
  untouched** — Settings → Data → "Clear cached data" with at least one
  populated team and one roster entry; reopen both afterward and confirm
  every field (species name, types, ability, moves) is exactly as it was.
- [ ] **Debug seed data**, debug build only: a fresh install with an empty
  database shows two teams ("Kanto Starters", partially filled; "National
  Dex All-Stars", full) and two custom roster entries on first launch,
  with no re-seeding (and no duplication) on subsequent launches or after
  creating a real team of your own.

### Known regressions

None yet.

## Phase 3 — Coverage analysis

- [ ] **The coverage basis notice is accurate.** With "Enable move slots"
  on and every filled slot carrying at least one damaging move, the
  notice reads "Analysis based on entered moves." With the toggle off
  (even if slots still have moves saved), it reads "Analysis based on
  Pokémon types only." With the toggle on and only *some* slots carrying
  a damaging move, it reads the mixed message naming which species use
  which basis.
- [ ] **Per-Pokémon cards are collapsed by default** and expand on tap,
  showing weaknesses (4×/2×), resistances (½×/¼×), immunities, the
  ability's own coverage effect (if any — e.g. Levitate showing a Ground
  immunity, Wonder Guard showing its note) and, when it has damaging
  moves, its move-type coverage.
- [ ] **Both coverage grids scroll independently, horizontally, without
  ever scrolling the screen itself sideways** — the Pokémon name column
  stays pinned in both while the 18 type columns (plus the Team
  best/Most vulnerable summary row) scroll under your finger.
- [ ] **Shared weaknesses show a count**, not just a badge — two team
  members both weak to the same type shows "×2", three shows "×3".
- [ ] **Uncovered types** lists every type nothing on the team hits
  super-effectively; with a team that covers all 18, the section
  instead shows the "full coverage" message.
- [ ] **Type overrides on a slot change the Analysis tab too** — override
  a slot's type from the slot editor (Phase 2), reopen the team, confirm
  the Analysis tab's grids and per-Pokémon card reflect the override, not
  the species' real types.
- [ ] **An empty team shows the "add Pokémon first" message**, not any of
  the seven sections, on the Analysis tab.

### Known regressions

None yet.

## Phase 4 — Suggestions and Surprise Me

- [ ] **Addition mode.** With a team of fewer than six, the Suggestions
  section shows up to five "add" cards — sprite, name, type badges, gain,
  composite score, newly covered types and new weaknesses. Tapping one
  fills the first empty slot with it immediately.
- [ ] **Replacement mode.** With a full team of six, every card instead
  names which member it would replace; tapping one swaps that slot's
  Pokémon in place, leaving the other five slots untouched.
- [ ] **Generation filter uses the real generation, not an id range.**
  Filter Suggestions to Generation I — Mega/regional/alternate forms of
  Generation I species now appear (they would have been wrongly excluded,
  or shown under the wrong generation, under the old id-range scheme).
- [ ] **"Include custom Pokémon" and "exclude legendaries/mythicals"
  toggles** actually change the candidate list — a saved custom roster
  entry appears only with the toggle on; a legendary/mythical drops out
  with "exclude" on unless the team already has one.
- [ ] **No suggestions message.** A team with nothing left to suggest (or
  an empty synced catalogue) shows the "no suggestions" message instead
  of an empty section.
- [ ] **Solid coverage message.** A team whose offensive coverage is
  already complete shows "Your team coverage is already solid.
  Alternatives:" above the five suggestion cards (all showing zero
  gain), rather than five zero-gain cards with no framing.
- [ ] **Surprise Me — anchors.** From Teams, tap the dice icon. Search and
  lock up to 5 Pokémon; each appears as a removable chip. Locking a 6th
  is blocked with the "all slots locked" warning shown.
- [ ] **Surprise Me — constraints and generate.** Adjust the starter/
  legendary-mythical/Mega/Dynamax counters (each capped so the total plus
  locked anchors never exceeds 6); Generate produces a full team, anchors
  first and unchanged.
- [ ] **Surprise Me — custom slots actually place custom Pokémon.** With
  at least one saved custom roster entry, the "Custom" counter appears;
  setting it to N and generating yields exactly N custom Pokémon in the
  result (previously it silently placed none while still consuming the
  six-slot budget — see Known regressions below).
- [ ] **Surprise Me — regenerate.** Regenerating a single (non-anchor)
  slot changes only that slot; "Regenerate all" produces an entirely new
  team respecting the same anchors and constraints.
- [ ] **Surprise Me — too few eligible Pokémon.** With constraints that
  can't be satisfied from the synced catalogue, the warning message
  appears and the returned team is shorter than 6.
- [ ] **Surprise Me — Keep.** Tapping Keep prompts for a team name, then
  creates a brand-new team with the generated six slots and navigates to
  it — the Teams list shows it immediately.
- [ ] **Surprise Me — generating shows a progress indicator, not a
  frozen UI.** Tapping Generate (or Regenerate/Regenerate all) shows a
  spinner and disables the other generation actions until it finishes —
  the app never appears to hang, even with a large synced catalogue
  (previously this ran on the main thread; see Known regressions below).

### Known regressions

- **Fixed 2026-09-05.** "Regenerate" on a single Surprise Me slot could
  crash with `IllegalArgumentException: Comparison method violates its
  general contract!` once the eligible candidate pool was large — found by
  code review (`docs/post-migration-review.md`, finding 1), not by manual
  testing; reproduced with a standalone JVM harness before the fix, not on
  a device. `regenerateSlot`'s candidate ranking now scores each candidate
  once instead of re-rolling the random tie-breaker on every comparison.
- **Fixed 2026-09-05.** Surprise Me's "Custom slots" stepper consumed the
  six-slot budget (`remainingSlots`, `budgetFull`) but never placed a
  single custom Pokémon — `TeamGenerator.kt` never read
  `GeneratorConstraints.customSlots` — found by code review
  (`docs/post-migration-review.md`, finding 5), not by manual testing.
  `generateTeam` and `regenerateSlot` now treat `customSlots` as a
  reserved category, filled from the custom roster already loaded into
  `SurpriseMeViewModel`'s UI state.
- **Fixed 2026-09-05.** `AnalysisViewModel`'s coverage/suggestions
  pipeline and both of `SurpriseMeViewModel`'s generator entry points ran
  on `Dispatchers.Main.immediate` — found by code review
  (`docs/post-migration-review.md`, finding 2), not by manual testing (no
  device profiling backs the "real work" claim; it follows from the
  algorithmic cost against a production-sized catalogue). Both now run on
  `Dispatchers.Default`; Surprise Me additionally gained a progress
  indicator and disables its generation actions while one is in flight.
- **Fixed 2026-09-05.** `computeCompositeScore` redid the same per-team
  work (offensive coverage union, weakness map) from scratch for every
  candidate — found by code review
  (`docs/post-migration-review.md`, finding 3), not measured on a
  device. In replacement mode (a full team of six) that meant six
  redundant recomputations per candidate instead of one overall.
  Behaviour-preserving: same suggestions, same scores, same ranking —
  covered by the existing `SuggestionEngineTest`/`TeamGeneratorTest`
  suites, no new test needed.
- **Corrected 2026-09-05, not a regression.** The post-migration review's
  original finding 4 claimed the Suggestions panel was missing a
  type-filter, a best/random mode toggle, and showed 5 cards where the
  PWA showed 10. `docs/plan/native-spec.md`'s own "Suggestion engine"
  section says "Return the top 5 by `gain`" for both addition and
  replacement mode, and none of the other three items appear in it
  either — the current behaviour is spec-compliant, not a shortfall. See
  the corrected finding 4 in `docs/post-migration-review.md`. Added only
  the one narrow, independent item that survived the correction: a
  "solid coverage" message when every displayed suggestion has zero
  gain; also removed one genuinely orphaned string resource
  (`suggestions_exclude_legendaries`, referenced by no composable).
- **Fixed 2026-09-05.** `weaknesses()` (shared by suggestions and the
  generator) never took an ability, unlike the coverage grid's own
  `sharedWeaknessCounts`/`defensiveProfile` — found by code review
  (`docs/post-migration-review.md`, finding 6), not by manual testing.
  A team member's ability could remove a weakness on the coverage grid
  while the Suggestions section, on the same screen, still counted that
  weakness as "aggravated" by a candidate. `weaknesses()` now takes an
  `ability` parameter, threaded through from both the candidate and every
  team member scored against; `memberFromEntry` also now gives a
  catalogue candidate its real default ability instead of always `null`.
  This changes composite scores for any team/candidate with a
  scoring-relevant ability — verify by hand: give a team member Levitate,
  then check that a Ground-weak suggestion candidate is no longer marked
  as aggravating that weakness.

## Phase 5 — Showdown import/export, settings and local backup

- [ ] **Export a team, copy to clipboard.** A team's overflow menu →
  "Export to Showdown" shows the exported block; Copy, then paste into a
  text editor or directly into Pokémon Showdown's team builder — species,
  ability, moves and the `# Types:` comment all appear correctly.
- [ ] **Export a team, save to file.** Same dialog → "Save to file" (SAF)
  → pick a location → confirm the `.txt` file was written with the same
  content shown in the dialog.
- [ ] **Import from pasted text.** Settings → "Import from Showdown" →
  paste a real Showdown export (six Pokémon, real moves) → Parse shows
  all six with sprites and types before creating anything → Create team
  prompts for a name → the new team appears in Teams with every slot
  filled correctly.
- [ ] **Import from a file.** Same screen → "Open file" (SAF) → pick a
  `.txt` exported earlier → the pasted-text field fills in and Parse
  works identically.
- [ ] **Unknown moves still import.** Paste a block naming a move that
  doesn't exist in the synced catalogue (a typo, or a move from a
  different game) — that slot still gets created, flagged with how many
  moves need completing, not dropped or rejected.
- [ ] **Unknown species are skipped, not fatal.** A multi-block paste
  where one species name doesn't match anything in the catalogue: the
  other species still import, and the skipped name is listed.
- [ ] **Settings → Team Suggestions toggles actually filter.** Turn off
  "Include Mega/Dynamax/Gigantamax forms" — a Mega Pokémon no longer
  appears as a suggestion (the species picker is unaffected). Turn off
  "Include Legendary & Mythical Pokémon" on a team with none — legendaries
  stop appearing as suggestions; a team that already has one still
  suggests more.
- [ ] **Local backup export.** Settings → Local backup → Export → pick a
  location — the saved `.zip` is non-trivial in size and named with a
  timestamp.
- [ ] **Local backup restore, same install.** Add a team, export a
  backup, then change something (rename a team, add another) — Import →
  pick the backup file → confirm the replace warning → every team and
  roster entry matches exactly what was in the backup, extra changes
  gone.
- [ ] **Local backup restore across a reinstall.** Export a backup,
  uninstall CoverDex, reinstall it, sync the dataset, then restore the
  backup — teams and the custom roster come back exactly as they were;
  the Pokédex cache is unaffected either way (it was never part of the
  backup).
- [ ] **A backup from a future app version is refused.** (If a test build
  with a bumped backup format is available.) Attempting to restore it
  shows a clear "too new" message and changes nothing.
- [ ] **Language switch applies to every new screen from this phase** —
  the import screen, the Settings additions, both backup dialogs — not
  just the ones that existed before Phase 5.

### Known regressions

- **Fixed 2026-09-12.** Importing a real Pokémon Showdown export containing
  a `Level:`, `Tera Type:`, `Shiny: Yes`, or similar field this app doesn't
  track corrupted the species (the parser mistook any unrecognized line
  for a new species line) — see `docs/implementation-decisions.md`,
  "Showdown format compatibility". Found by auditing the parser against
  the real client's own grammar, not by manual testing. Re-run "Import
  from pasted text" above with a Gen 9 set that includes `Tera Type:` to
  confirm the species now imports correctly.

## Phase 6 — Release

- [ ] **`./gradlew signingReport` shows the release config** once the
  four `RELEASE_KEYSTORE_*`/`RELEASE_KEY_*` env vars are set locally
  (or check the `build-apk.yml` workflow run's own `signingReport` step)
  — the release variant's SHA-256 matches the keystore that was generated,
  not the debug key.
- [ ] **`build-apk.yml` (manual dispatch) produces an installable, signed
  APK** — download the `app-release` artifact, install it over the
  previous debug build on a real device, confirm it launches with data
  intact (`applicationId` unchanged means this is a real upgrade test,
  not a fresh install).
- [ ] **`release.yml` (manual dispatch, a real `x.y.z`) end to end**:
  the workflow rejects a version not strictly greater than the current
  `versionName`; on success, `CHANGELOG.md`'s `[Unreleased]` section is
  gone (folded into a new dated section), `app/build.gradle.kts`'s
  `versionCode`/`versionName` are bumped and pushed back to `main`, a
  GitHub Release exists with the changelog's bold lead-ins as its body,
  and the attached APK installs and runs.
- [ ] **A fresh install of the released APK, with no prior CoverDex data
  on the device**, completes the first-launch sync and is fully usable —
  this is the actual out-of-box experience for anyone who is not
  upgrading from the Capacitor build.
- [ ] **An upgrade install from the last Capacitor-era release** (if that
  APK is still available) shows the documented, deliberate data loss —
  saved teams and the custom roster are gone, not silently migrated —
  matching what `README.md`'s upgrade warning and the `2.0.0` changelog
  entry both say plainly.

### Known regressions

None yet.

## Phase 7 — Engine accuracy, abilities/items, BST-aware suggestions

- [ ] **The ability picker's canonical list.** Pick a real species in a
  slot — the ability field opens as a dropdown of its real abilities
  (normal slots first, then any hidden one marked "(hidden)"), each
  showing its correct name (e.g. "Sap Sipper", not `sap-sipper`). An
  ability with a coverage effect is marked with a small dot.
- [ ] **"Custom ability…" still accepts anything.** Selecting the
  picker's last entry swaps to a free-text field with suggestions from
  the full catalogue; typing an ability that exists in no PokéAPI table
  (a ROM hack assignment) is still accepted and saved verbatim. A "back
  to canonical" action returns to the species' own list.
- [ ] **A hand-typed/roster Pokémon's ability field goes straight to free
  text** — no canonical list to show since it has no catalogue species.
- [ ] **Ability and move names show correct capitalization everywhere** —
  spot-check `Well-Baked Body`, `Double-Edge`, `U-turn`, `Will-O-Wisp` in
  the ability/move pickers and on the Analysis tab's per-Pokémon cards.
- [ ] **The item field.** A new field below ability in the slot editor
  and roster editor accepts free text with suggestions from the modelled
  set (Air Balloon, Iron Ball, Ring Target, the type-resist berries).
  Setting one shows on the team screen's slot card ("@ Item") and on the
  Analysis tab's per-Pokémon card with its effect summary when it has
  one (e.g. Air Balloon → "immune to Ground").
- [ ] **Items round-trip.** Export a team with an item set to Showdown
  format (overflow menu) — the exported text reads `Species @ Item`.
  Re-import it (Settings → Import) and confirm the item is preserved. A
  local backup (Settings → Backup) exported and restored also keeps
  every item.
- [ ] **The abilities the Phase 7 audit added actually change the
  Analysis tab.** Give a slot Wonder Guard and confirm its per-Pokémon
  card shows every incoming type bucketed as either "immune" (anything
  not super-effective) or its real weakness (anything that is) — not the
  old "badge with no calculation effect". Give a slot Scrappy or Mind's
  Eye and a Normal move, then check the offensive coverage grid shows a
  neutral (not 0×) hit against Ghost-type opponents.
- [ ] **Suggestions on an already-solid team lead with strong Pokémon.**
  Build a team whose type coverage is already complete (the Analysis
  tab's suggestions section shows the "coverage is already solid" note)
  — the alternatives listed should be generally strong species, not the
  lowest-numbered Pokédex entries of whatever typing ties on score. Each
  card shows its base stat total under the score.
- [ ] **The suggestion-count setting.** Settings → Team Suggestions has a
  "Number of suggestions shown" stepper, 5 to 10, default 5; changing it
  immediately changes how many cards the Analysis tab's Suggestions
  section shows.
- [ ] **A fresh install and an upgrade from a Phase-6-era (Room v2)
  database both work.** A fresh install syncs and shows base stats and
  canonical abilities as above. An existing install (upgrading from a
  build before this phase) re-syncs automatically on next launch (the
  cache schema version bump forces this) and ends up in the same state —
  no crash, no stale "sap-sipper"-style ability text left over from
  before the fix, existing teams and roster entries untouched.

### Known regressions

None yet.
