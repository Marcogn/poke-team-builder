# Next steps

A concise backlog of known remaining work, for whoever picks this project
up next. Every item cites where it's documented — this file doesn't
introduce anything new, it just collects what's already written down
across `CHANGELOG.md`, `docs/STATUS.md`, `ROADMAP.md` and
`docs/post-migration-review.md` into one place. Re-check the cited source
before acting — this file can go stale like any other.

## Ready to ship

- **Cut a release for the `[Unreleased]` Showdown import fix.** Two real
  bugs are fixed on `main` but not yet in a tagged release: importing a
  real Pokémon Showdown export with a `Level:`/`Tera Type:`/`Shiny:`-style
  line used to corrupt the species, and the exporter used to write blank
  `Ability:`/`EVs:`/`Nature` placeholder lines and a dangling `@ `. See
  `CHANGELOG.md`'s `[Unreleased]` section and
  `docs/implementation-decisions.md`, "Showdown format compatibility".
  Cutting the release is a manual `Release` workflow dispatch — see
  `CLAUDE.md`, "Changelog and release process", and
  `docs/release-signing.md` for the signing prerequisites (already
  satisfied as of `2.0.0`/`2.0.1`).

## Deliberately deferred (not bugs)

- **Generational type charts and generational typings.** The pinned
  dataset already downloads `type_efficacy_past.csv` (Gen-1
  Ghost/Psychic and Bug/Poison interactions, the pre-Gen-6 Steel/Dark
  resistance to Ghost, ...) and `pokemon_types_past.csv` (pre-Fairy-retcon
  typings — Clefairy et al. were Normal-type through Gen 5), but neither
  file is ever read. There is no existing "which generation's rules am I
  analysing against" concept to hang this on anywhere else in the app —
  a genuine feature, not a bug fix. See `ROADMAP.md`, "Deliberately not
  planned", and `docs/plan/phase-7-accuracy-and-customization.md` §0.6/§7.4.
- **Four pre-existing suggestion-engine characteristics**, found while
  auditing the engine for Phase 7 and each left as-is for its own
  documented reason (see `docs/post-migration-review.md`, "Phase 7
  audit", and `docs/STATUS.md`, "What's known to be missing"):
  - `Suggestion.gain`'s meaning differs between addition mode and
    replacement mode.
  - `weaknesses()` counts weakness *types*, not magnitude — a x4 and a x2
    weakness score identically.
  - Replacement mode computes one context's score twice.
  - A custom roster entry named after a catalogue species can be silently
    deduplicated away.
- **The slot editor's species picker never searches the custom roster.**
  Unlike `legacy-web`'s "Include saved custom Pokémon in search" checkbox,
  the native species picker (`SearchableDropdown`, backed by
  `PokedexRepository`) only searches the synced catalogue — a custom
  roster entry can only be placed into a slot via "Save as custom" on
  that same slot, not found by name from another slot's picker.
  `phase-2-teams-and-roster.md`'s own description of the species picker
  never mentions the roster as a search source, so this was never
  implemented rather than regressed. See `docs/STATUS.md`, "What's known
  to be missing" (filed under Phase 2).

## Out of scope (tracked, not backlog)

`ROADMAP.md`'s "Deliberately not planned" list (Play Store submission,
iOS, a backend, account/multi-user concepts, damage calculation/battle
simulation/EV-IV tracking/legality validation, migrating data from the
Capacitor build) is a permanent no-list, not deferred work — repeated here
only so this file's "what's left" scope is unambiguous. See
`docs/plan/native-spec.md`, "Explicitly out of scope", for the reasoning
behind each one.
