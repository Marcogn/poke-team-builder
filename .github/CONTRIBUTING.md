# Contributing

Thanks for considering a contribution to the Pokémon Team Analyzer.

## Workflow

1. **Fork** the repository to your own account.
2. **Branch** from `main` using one of the following prefixes:
   - `feature/<short-name>` for new functionality
   - `fix/<short-name>` for bug fixes
   - `docs/<short-name>` for documentation-only changes
3. Make your changes.
4. **Run the tests** before opening a PR:
   ```bash
   npm run test
   ```
5. Open a pull request against `main`.

## PR description

Every pull request description must include:

- **What changed** — a concise summary of the user-visible or
  architectural change.
- **Why** — the motivation or the issue it addresses.
- **Which tests cover it** — the test files (and ideally test names)
  that exercise the change.

## House rules

- **Do not change the `localStorage` cache schema** without including a
  written migration plan in the PR description. The cache key is bumped
  alongside any schema change.
- **Do not add new npm dependencies** without discussing the need in an
  issue first. Prefer standard library, existing dependencies, or a
  small local implementation.
- Keep changes scoped. Unrelated fixes belong in their own PR.
- Follow the conventions documented in [`CLAUDE.md`](../CLAUDE.md) —
  especially the module responsibilities and the Showdown format
  contract.
