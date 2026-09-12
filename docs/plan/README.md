# Native Android migration — how to execute this plan

CoverDex is being converted from a React/Capacitor PWA into a **native
Android app**: Kotlin, Jetpack Compose, Material 3, Room, Hilt,
ViewModel/StateFlow. GitHub Pages and the whole web-release path are
removed. The reference implementation for every architectural decision is
the sibling project **Hall of Memories** (`marcogn/hall-of-memories`),
checked out alongside this repo during planning at `../Hall-Of-Memories`.

These files are written to be executed by a coding agent, **one phase per
session**, with no further design work required. Everything that could be
decided in advance has been decided; where a phase leaves something open it
says so explicitly and tells you what to do about it.

## Order

| Phase | File | Ships |
|---|---|---|
| 0 | [`phase-0-foundation.md`](phase-0-foundation.md) | Native Gradle project, Hilt, Compose, theme, i18n, navigation skeleton, CI. Capacitor and the Pages release path deleted; the web app parked in `legacy-web/` |
| 1 | [`phase-1-dataset-sync.md`](phase-1-dataset-sync.md) | The fast dataset sync, Room cache, sprite resolver, Settings → Data |
| 2 | [`phase-2-teams-and-roster.md`](phase-2-teams-and-roster.md) | Room user schema, teams list, team detail, slot editing, custom roster |
| 3 | [`phase-3-analysis.md`](phase-3-analysis.md) | Coverage engine port + the seven-section analysis screen |
| 4 | [`phase-4-suggestions-and-generator.md`](phase-4-suggestions-and-generator.md) | Suggestion engine, composite scoring, Surprise Me generator |
| 5 | [`phase-5-import-export-and-settings.md`](phase-5-import-export-and-settings.md) | Showdown import/export, settings, theme and language, local backup |
| 6 | [`phase-6-release.md`](phase-6-release.md) | Signing, release pipeline, docs rewrite, `legacy-web/` deleted |
| 7 | [`phase-7-accuracy-and-customization.md`](phase-7-accuracy-and-customization.md) | Base stats + correct English ability/move names in the dataset, canonical-vs-custom ability picking, held items (defensive subset), BST tie-break for suggestions, configurable suggestion count, and the ability-effect gaps the Phase 7 audit found |

Read before starting any phase: [`../../CLAUDE.md`](../../CLAUDE.md),
[`native-spec.md`](native-spec.md), this file, the phase file itself, and
[`reference-pokedata.md`](reference-pokedata.md) if the phase touches the
dataset or sprites.

**Do not start a phase before the previous one is merged.** Each phase
assumes the previous one's code exists and compiles.

## The two reference codebases

You are working with two references, and they are used for different things.
Confusing them is the main way this plan goes wrong.

**Hall of Memories (`../Hall-Of-Memories`) is the architectural reference.**
Copy its Gradle setup, its version catalogue, its Hilt modules, its Room +
`Flow` + `combine()` ViewModel shape, its `HttpURLConnection` client style,
its sprite fallback composable, its SAF backup code, its three CI workflows,
its `CLAUDE.md` conventions. Six shipped phases of the same stack by the same
author. **Copy its patterns rather than inventing new ones.** Read its
`CLAUDE.md` "Known gotchas" section in full before writing any Kotlin — every
entry there cost someone real debugging time.

**`legacy-web/` is the behavioural reference.** It is this repo's own React
code, moved aside in Phase 0 and deleted in Phase 6. It is the specification
for *what the app does*: the coverage maths, the suggestion ranking, the
composite score weights, the Showdown format contract, every UI string in
both languages. Its Vitest suite (23 files, 175 tests) is the **oracle for
expected values** when porting an engine — when the Kotlin and the TypeScript
disagree about a number, the TypeScript is right unless this plan explicitly
says otherwise.

```bash
cd legacy-web && npm ci && npm test        # run the oracle
```

`legacy-web/` is excluded from CI and is never edited. If you find a bug in
it, note it in the phase file and fix it in the Kotlin.

## Working rules

1. **Stay inside the phase.** If you spot something worth doing that belongs
   to a later phase, write it into that phase's file as a `> NOTE from
   phase N:` line instead of implementing it.
2. **Copy Hall of Memories, don't invent.** See above. Matching its patterns
   is worth more than a marginally better idea.
3. **No new dependencies** beyond the catalogue pinned in Phase 0. If a phase
   seems to need one, stop and flag it in the PR description instead of
   adding it. CSV parsing, the HTTP client, the sprite fallback chain and
   the placeholder art are all hand-rolled, exactly as in the sibling app.
4. **No hardcoded user-visible strings.** Every one goes through
   `stringResource()` (Compose) or `context.getString()` (ViewModel, with
   `@ApplicationContext` injected) and lands in **both**
   `res/values/strings.xml` (Italian, the default locale) and
   `res/values-en/strings.xml` (English) in the same commit. A key present
   in only one silently falls back to Italian. The source of the wording is
   `legacy-web/src/i18n/locales/{it,en}.json` — port the text, do not
   reinvent it.
5. **Room migrations are additive and numbered.**
   `fallbackToDestructiveMigration()` is banned outright. Phase 1 creates
   schema v1; anything after it that changes a table writes a numbered
   `MIGRATION_x_y` and bumps the version.
6. **Pure logic lives in `domain/`** with no Android imports, so it is
   unit-testable on the plain JVM without Robolectric: the coverage engine,
   the suggestion engine, the team generator, the Showdown parser, the CSV
   parser, sprite URL resolution, ability effects. `data/` owns everything
   that touches Android, Room or the network. This split is what makes the
   ported engines testable against `legacy-web`'s expected values.
7. **Changelog as you go.** Every phase adds its entries to `CHANGELOG.md`'s
   `## [Unreleased]` section, in the convention described in `CLAUDE.md`
   (one bold lead-in per user-facing change) — the release workflow reads
   exactly those lead-ins.
8. **Update the docs the phase touches.** `docs/test-plan.md` gets a new
   section per phase; `docs/implementation-decisions.md` gets an entry for
   every non-obvious choice you had to make; this file's phase-status list
   and `CLAUDE.md`'s get ticked.

## Behavioural parity is the acceptance criterion

This is a rewrite of a working app, not a new app. For every engine you
port, the phase file names the `legacy-web` test file that defines its
behaviour, and the Kotlin test suite must assert **the same expected values**
— ported case by case, not re-derived. Where a Kotlin test cannot express a
case (probabilistic generator runs, React rendering), the phase says so.

There is exactly **one** intentional behavioural change in the whole plan:
the generation filter moves from hardcoded id ranges to the real
`generation_id`. It is described in
[`reference-pokedata.md`](reference-pokedata.md) §4. Anything else that
differs is a bug.

## Definition of done, every phase

- [ ] Everything in the phase's "Deliverables" exists and compiles.
- [ ] The unit tests listed in the phase are written and pass.
- [ ] `./gradlew testDebugUnitTest lintDebug assembleDebug` is green — or, if
      the environment has no Android SDK (see below), the `Android CI`
      workflow run for the pushed branch is green.
- [ ] `CHANGELOG.md` `[Unreleased]` updated.
- [ ] `docs/test-plan.md` has this phase's manual-verification section.
- [ ] The phase-status list in this file and in `CLAUDE.md` is updated.
- [ ] Committed and pushed to the working branch; draft PR opened or updated.

## Building in a sandboxed session

`./gradlew` needs both the Maven repositories (`dl.google.com`,
`repo1.maven.org`) **and** an Android SDK. In the planning session the
network was reachable but `ANDROID_HOME` was unset and no SDK was installed.
Check, in this order, and do not burn time fighting it:

```bash
curl -sfo /dev/null -w '%{http_code}\n' https://dl.google.com/dl/android/maven2/com/android/tools/build/gradle/8.13.0/gradle-8.13.0.pom
echo "$ANDROID_HOME"; command -v sdkmanager
```

If there is no SDK and none can be installed, say so plainly in the PR,
push, and let the `Android CI` workflow do the verification — then read its
logs and fix forward. **Never report a build as passing that you did not
run.**

## Verification you cannot automate

Some things have no meaningful test on this stack: the real network sync end
to end, `AppCompatDelegate` language switching, real sprite rendering and
its 404 fallbacks, the SAF file pickers, clipboard interaction. Those go
into `docs/test-plan.md` as manual on-device steps for the user, and every
real bug found that way gets an entry in that file's "Known regressions".

## Commits and PRs

- Small, logical commits with imperative English messages
  (`Add the CSV dataset client and its cache tables`).
- Branch: the one named in the session instructions.
- Push, then open a **draft** PR whose description lists what the phase
  delivered, what is deliberately not done yet, and anything you had to
  decide that the plan did not cover.

## Progress status by phase

- **Phase 0 — Foundation**: ✅ done
- **Phase 1 — Dataset sync**: ✅ done
- **Phase 2 — Teams and roster**: ✅ done
- **Phase 3 — Analysis**: ✅ done
- **Phase 4 — Suggestions and generator**: ✅ done
- **Phase 5 — Import/export and settings**: ✅ done
- **Phase 6 — Release**: ✅ done
- **Phase 7 — Engine accuracy, abilities/items, BST ranking**: ✅ done —
  see [`phase-7-accuracy-and-customization.md`](phase-7-accuracy-and-customization.md)
