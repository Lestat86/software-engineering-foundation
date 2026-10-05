# ADR 0012: debt, suppressions and complexity are enforced by the lint gate

- **Status:** proposed
- **Date:** 2026-10-05

## Context

After bootstrap, the generated project's lint gate enforced code form, typed
linting and accessibility, but three expectations of the standard were checked
by nobody:

- `CORE-DEBT-001` asked for issue-linked debt markers and no commented-out code
  as a SHOULD, verified by searching the diff by hand.
- The governance rule that inline suppressions carry a reason had no check:
  `reportUnusedDisableDirectives` removes stale directives but accepts an
  undocumented or file-wide one.
- No bound existed on function complexity, the place where regressions in a
  growing codebase concentrate. `CORE-CLARITY-001` is a SHOULD with no
  observable check.

Projects are increasingly written by agents. An agent pushed to pass a gate
takes the shortest path, such as an undescribed `eslint-disable` or a marker
that defers work indefinitely, so an expectation that only a reviewer checks
erodes faster than before.

## Decision

- Raise `CORE-DEBT-001` to MUST: every `TODO` or `FIXME` references its issue
  as `TODO(#123)`, and commented-out code is removed. A local rule,
  `foundation/todo-issue-reference` in `base.mjs`, checks the markers and
  accepts a project-specific reference pattern as an option;
  `sonarjs/no-commented-code` checks the code.
- Add `CORE-SUPPRESS-001`: a disable directive names its rules and states a
  reason after `--`, enforced by `@eslint-community/eslint-plugin-eslint-comments`.
- Add `CORE-COMPLEXITY-001`: cognitive complexity at most 15 per function and
  nesting at most four levels, enforced by `sonarjs/cognitive-complexity` and
  `max-depth`.
- Apply the `eslint-plugin-sonarjs` recommended rules to every source file,
  without its settings, and replace its `todo-tag` and `fixme-tag` rules with
  the issue-reference rule. Turn `sonarjs/null-dereference` off for TypeScript,
  where it ignores types and reports values that `strictNullChecks` already
  proves non-null.
- Treat SonarJS security-hotspot rules as review points: a reviewed and correct
  site keeps the rule and carries a described suppression.
- Apply all of it to this repository's own scripts and tests.

## Consequences

The three expectations fail on the first violation in every generated project
and in this repository. Applying them here required one refactor in the
generator (cognitive complexity 19), explicit assertions in the tests that
relied on a thrown error, four regular expressions rewritten without
backtracking and three described suppressions for trusted input and for Git
resolved from the developer's `PATH`.

`sonarjs/no-commented-code` parses comments as JavaScript, so commented-out
TypeScript with type annotations is not always detected; review still applies.

Code that passed the 2.x gate can fail the new one, so this is a breaking
change and the foundation moves to its next major version at release. To
migrate, run `corepack yarn lint`, add issue references to the reported
markers, delete commented-out code, describe or remove the reported directives
and split the reported functions. Projects with a large existing backlog can
freeze it with ESLint bulk suppressions and reduce it over time, as planned for
retrofits.
