# ADR 0017: a local pre-merge gate measures coverage of the changed lines

- **Status:** proposed
- **Date:** 2026-10-05

## Context

`TEST-CHANGE-001` requires tests for every changed behavior, and
`TEST-COVERAGE-001` rejects a single repository-wide percentage while allowing
thresholds on changed code. Neither had a check: `yarn test` proves that the
existing tests pass, not that the new code is tested. Agents in particular can
add behavior that every existing test happily ignores.

Not every project has a pipeline, so the check has to run locally, and the
person opening the pull request attests to it.

## Decision

- Add a `premerge` script that runs `lint`, `typecheck` and `build`, then
  `.config/foundation/premerge.mjs`.
- The script runs `test` with V8 coverage through the script contract, so the
  same command works in single packages and monorepos, and intersects the
  report with the lines changed since the merge base of `premerge.baseRef`,
  overridable with `FOUNDATION_BASE_REF`.
- A changed line is measured when a statement starts on it. The coverage scope
  is declared in each template's `vitest.config`, which excludes tests and the
  entry points that only wire the process.
- Fail below `premerge.diffCoverage`, 80 by default, listing the uncovered
  lines; warn when the working tree is not committed; end with
  `premerge: passed on <sha>` for the pull request checklist.
- Record `baseRef`, `diffCoverage` and `mutationScore` in the manifest,
  validated by `check-foundation.mjs`.
- Add `@vitest/coverage-v8`, pinned to the exact vitest version it requires.

## Consequences

A branch that adds untested code fails before review, with the lines to test.
The measure counts statements, not branches: a changed line whose statement
ran is covered even if only one side of a condition was exercised. Mutation
testing, recorded with its own threshold, complements it.

`premerge` runs the test suite once, with coverage, instead of running it
again after `validate`. Untracked files are not part of the diff; the
uncommitted-changes warning covers that case.
