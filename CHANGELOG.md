# Changelog

All notable changes to CoverDex are recorded here, one entry per
release. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

- **New app icon.** Replaced the launcher icon carried over verbatim from
  the Capacitor build with new artwork (a red Pokédex-style handheld next
  to a notepad and pencil). The artwork is scaled to ~60% and centered so
  it stays fully inside Android's 66dp/108dp adaptive-icon safe zone —
  verified with a pixel-level check that no visible content falls outside
  that zone under any launcher mask shape (circle, squircle, rounded
  square) — see `docs/implementation-decisions.md`, "New app icon".
- **Fixed Showdown import silently corrupting the species on any set with a
  `Level:`, `Tera Type:`, `Shiny:`, or similar optional field.** Verified
  against Pokémon Showdown's own text-format grammar
  (`sim/teams.ts` in smogon/pokemon-showdown): the parser used to treat
  any unrecognized line as a fresh species line, so pasting a real,
  everyday Showdown export (Gen 9 sets almost always carry a
  `Tera Type:` line) overwrote the species with that line's text and
  broke import. Only the block's first line is a species line now, every
  other unrecognized line is ignored, and nickname/gender markers
  (`Volt Turtle (Pikachu) @ Light Ball`, `Pikachu (F)`) are stripped
  before matching — see `docs/implementation-decisions.md`, "Showdown
  format compatibility".
- **Showdown export no longer writes blank `Ability:`/`EVs:`/`Nature`
  placeholder lines or a dangling `@ ` with nothing after it.** Real
  Showdown omits a field's line entirely when it's unset; the exported
  text now matches that shape exactly instead of relying on the real
  client happening to ignore the old placeholders.

## [2.0.1] - 2026-09-06

- **Fixed a crash in "Regenerate" (Surprise Me).** `regenerateSlot`'s
  candidate ranking re-evaluated its composite score (including the random
  tie-breaking noise) on every comparator invocation instead of once per
  candidate, which could throw `IllegalArgumentException: Comparison
  method violates its general contract!` once the eligible pool was large
  enough — see finding 1 in
  [`docs/post-migration-review.md`](docs/post-migration-review.md). The
  score is now computed once per candidate and sorted on the stored value.
- **Surprise Me's "Custom slots" now actually places custom Pokémon.**
  The stepper always consumed the six-slot budget but the generator never
  read the constraint, so it silently placed none — see finding 5 in
  [`docs/post-migration-review.md`](docs/post-migration-review.md).
  Reserving N custom slots now fills exactly N slots from the saved
  custom roster, the same "exactly N" semantics every other constraint
  category already had.
- **Coverage analysis and team generation no longer run on the main
  thread.** Both `AnalysisScreen`'s coverage/suggestions pipeline and
  Surprise Me's generator scored every eligible candidate against the
  whole team on `Dispatchers.Main.immediate` — real work against a
  catalogue in the high hundreds, not the handful of entries any unit
  test's pool has. See finding 2 in
  [`docs/post-migration-review.md`](docs/post-migration-review.md).
  Surprise Me now shows a progress indicator and disables its
  Generate/Regenerate actions while a generation is in flight.
- **Suggestions in replacement mode (a full team of six) score
  noticeably faster.** `computeCompositeScore` recomputed the same
  per-team data from scratch for every candidate — in replacement mode,
  six times per candidate instead of once overall. See finding 3 in
  [`docs/post-migration-review.md`](docs/post-migration-review.md). Same
  suggestions, same ranking, same composite scores — this is a pure
  performance fix.
- **Suggestions show a "coverage is already solid" note when every
  displayed card offers zero gain**, instead of five zero-gain cards
  with no framing. (An earlier draft of this entry also claimed the
  Suggestions panel was missing a type filter, a random mode, and showed
  5 cards where it should show 10 — `docs/plan/native-spec.md` says "top
  5" for this rewrite and specifies neither of the other two features,
  so those were not implemented; see finding 4's correction in
  [`docs/post-migration-review.md`](docs/post-migration-review.md).)
  Also removed one orphaned string resource
  (`suggestions_exclude_legendaries`) left over from Phase 4.
- **Suggestions and Surprise Me now honour a scoring-relevant ability
  the same way the Analysis screen's coverage grid already did.** A
  Levitate-holding teammate's Ground weakness no longer counts as
  "aggravated" against a candidate that shares it, and a candidate whose
  own ability removes a weakness is no longer penalized for it — one
  screen could previously disagree with itself on this. This changes
  composite scores for any team or candidate with an ability from
  `AbilityEffects.kt`'s known-effects list; see finding 6 in
  [`docs/post-migration-review.md`](docs/post-migration-review.md).
- **Post-migration review of the coverage and suggestion engines.** A
  code-level audit of the shipped app against the phase plans, diffing every
  Kotlin port against the TypeScript original recovered from git history.
  Records six findings and an ordered remediation plan in
  [`docs/post-migration-review.md`](docs/post-migration-review.md).
- **Abilities show their real name, not the raw PokéAPI slug.** Picking a
  species used to fill the ability field with `sap-sipper` instead of
  "Sap Sipper" — the ability picker one row below showed the correct
  name, so the same ability read two different ways on the same screen.
  Every ability and move name now comes from PokéAPI's own English name
  data instead of a naive hyphen-to-space conversion, which also fixes
  names that conversion gets wrong outright (Well-Baked Body, Double-Edge,
  U-turn, Will-O-Wisp, ...).
- **The ability field is now a canonical picker with a custom fallback.**
  Picking a species offers its real abilities (normal slots, then hidden)
  by name; a "Custom ability…" option opens the full catalogue with free
  text still accepted, so a ROM hack's non-canonical ability assignment
  stays typeable. An option that actually changes the weakness/resistance
  map is marked.
- **Ten previously unmodelled abilities now affect the coverage
  calculation**: Heatproof, Water Bubble, Purifying Salt, Filter, Solid
  Rock, Prism Armor, Primordial Sea, Desolate Land, Delta Stream, Tera
  Shell. Dry Skin's missed Fire weakness (1.25×) is now applied alongside
  its existing Water immunity. Wonder Guard is now a real effect instead
  of a display-only badge — only a super-effective hit deals any damage,
  matching Shedinja's actual mechanic. Scrappy and Mind's Eye now let
  Normal/Fighting moves hit Ghost-types in the offensive coverage grid,
  and Aerilate/Pixilate/Refrigerate/Galvanize/Normalize now rewrite a
  Normal-type move's coverage the way they do in the real games.
- **Held items affecting type coverage can now be assigned.** A new item
  field (free text, same "type it or pick it" contract as ability) models
  Air Balloon, Iron Ball, Ring Target and one resist berry per type. Items
  round-trip through Showdown export/import and local backups.
- **Suggestions on an already-strong team now lead with the strongest
  alternative, not the lowest Pokédex id.** Once a team's type coverage is
  complete every remaining candidate ties on the composite score, and the
  ranking used to fall through straight to ascending catalogue id —
  surfacing Raticate ahead of far stronger options for no reason connected
  to team building. A tied ranking now breaks by base stat total first
  (current-generation value, or the historical one for a chosen
  generation filter), with catalogue id as the final tie-break only.
  Suggestion cards show the candidate's base stat total and a plain-
  language explanation of the score.
- **The number of suggestions shown is now configurable**, 5 to 10
  (Settings → Team Suggestions), default 5 — previously hardcoded.
- **The dataset sync downloads four more small CSVs** (base stats,
  historical base stats, English ability names, English move names),
  ~213 KB → ~578 KB total — still a handful of requests, still well under
  a second on any real connection. See
  [`docs/plan/reference-pokedata.md`](docs/plan/reference-pokedata.md) §2.

## [2.0.0] - 2026-09-04

CoverDex is now a native Android app — the full six-phase rewrite
described in [`docs/plan/README.md`](docs/plan/README.md) is complete.

- **CoverDex is now a native Android app.** Kotlin, Jetpack Compose,
  Material 3, Room, Hilt — no more WebView, no more Capacitor. Same
  `applicationId` (`com.marcogn.coverdex`) so it installs over the old
  build.
- **First launch is effectively instant.** The Pokémon catalogue now
  syncs in about 8 requests and ~208 KB, down from roughly 3,875
  requests and ~426 MB in the old app — measured, not estimated, see
  `docs/plan/reference-pokedata.md`. The app is usable immediately behind
  a small non-blocking progress banner, not a loading screen.
- **The web app and GitHub Pages are discontinued.** The React/Capacitor
  codebase was parked in `legacy-web/` as a behavioural reference for the
  rewrite and has now been deleted — every engine, string and behaviour
  it defined has a native equivalent.
- **Saved teams do not carry over from the old app.** A deliberate,
  one-time clean break (see `docs/implementation-decisions.md`, "Phase
  0"). **Export your teams to Showdown format from the old app before
  updating**, if you still have it installed, then re-import them here
  afterward.
- **The suggestion engine's generation filter uses each candidate's real
  generation**, not the hardcoded Pokédex-id ranges the original web app
  used (`docs/plan/reference-pokedata.md` §4) — an alternate-form Pokémon
  with a high catalogue id (a Mega evolution, say) now filters by the
  generation its species actually belongs to, not always "Generation 9".
- **Teams are real now.** Create, rename, delete a team; each has six
  slots. Every slot has a species picker backed by the synced catalogue,
  type overrides (a ROM-hack-friendly feature the old app also had),
  an ability field, and — behind a persisted "Enable move slots" toggle —
  four move slots, each accepting either a cached move or a typed custom
  one. A slot can be saved into a reusable custom-Pokémon roster.
- **The custom Pokémon roster is a full screen now**: create, edit and
  delete entries with the same type/ability/move editor as a team slot,
  minus the species picker.
- **Coverage analysis is real now.** Every team's Analysis tab shows: what
  basis the analysis runs on (entered moves, Pokémon types, or a mix,
  clearly stated); a per-Pokémon breakdown of weaknesses, resistances,
  immunities and ability effects; full 18-type offensive and defensive
  coverage grids; the team's shared weaknesses; and the types nothing on
  the team can hit super-effectively.
- **Suggestions are real now.** The Analysis tab's seventh section ranks
  up to five candidates to add (team under six) or swap in (a full team)
  — sprite, types, coverage gain, composite score, newly covered types and
  new weaknesses — filterable by generation and "include custom Pokémon"
  right on the screen, plus two app-wide preferences in Settings (include
  Mega/Dynamax forms, include legendaries/mythicals). Tapping a card adds
  or replaces it in the team immediately.
- **Surprise Me builds a team for you.** A new screen, reached from Teams
  via the dice icon: lock 0-5 Pokémon you want kept, set how many
  starters/legendaries-mythicals/Mega/Dynamax slots to reserve, Generate,
  regenerate individual slots or the whole team, then Keep to create the
  new team.
- **Teams round-trip through Pokémon Showdown's team format.** Export a
  team from its overflow menu — copy to clipboard or save a `.txt` file —
  and import one from Settings, pasted or opened from a file: every
  recognized Pokémon is shown before you commit, with unresolved moves
  flagged per slot (they still import, as a placeholder to fill in) and
  unresolved species skipped and listed.
- **Every setting from the old app is here**, alongside theme, language
  and the dataset status/sync/clear controls: include Mega/Dynamax/
  Gigantamax forms and include legendaries/mythicals in Suggestions.
- **Local backup.** Settings → Local backup exports every team and the
  custom roster to a single file (never the Pokédex cache — that's
  re-downloaded) and restores from one, asking for confirmation first
  since a restore fully replaces what's on the device, with no merging.

## [1.0.0]

First public release, shipped simultaneously as the web app (PWA, on
GitHub Pages) and as a native Android app.

This is the initial release, so there is no prior version to diff
against — every feature described in [`README.md`](README.md) is new as
of this version. See that file for the full feature list, and
[`docs/STATUS.md`](docs/STATUS.md) for the current implementation
snapshot.
