# ADR 0022: existing projects adopt the foundation in waves behind baselines

- **Status:** proposed
- **Date:** 2026-10-05

## Context

The bootstrap skill explicitly excluded retrofitting existing applications.
Existing projects are where most of the code is, and they differ from a
generated project in their package manager, ESLint setup, hooks and layout.
Turning every rule on at once produces hundreds of errors, which either stops
work or gets the rules switched off.

## Decision

- Add the `retrofit-project` skill, run in the assisted mode: inventory, risk
  classification, gap assessment and one plan per pull request, in five
  waves: safety net, tools with baselines, mechanical fixes, risk-driven
  controls, baseline burn-down.
- Add `inventory-project.mjs`, a read-only script that reports the facts of a
  project and maps each to a requirement. It never writes to the target.
- Adopt the foundation files through `sync-foundation.mjs`, which already
  adopts a project without a hash record and writes `<file>.sef-new` beside
  the project's own versions.
- Freeze existing ESLint violations with ESLint's bulk suppressions and
  dependency violations with dependency-cruiser's known violations. ESLint
  fails on stale suppressions, so the baseline is pruned as code is fixed;
  `premerge` fails when either baseline has more entries than at the merge
  base, so it cannot grow.

## Consequences

New and changed code meets the foundation from the first wave, while the
existing backlog shrinks at the pace the team chooses. Each wave is a small
reviewable change, and the pilot can be paused between waves.

A rehearsal on a copy of a real project (workspaces, a Capacitor frontend, a
`shared/` folder behind path aliases, Yarn 1, its own ESLint preset) drove
these refinements:

- `sync-foundation.mjs` requires only the tools behind the checks and the
  foundation scripts; the stack versions the foundation verified are reported
  without blocking, so a project on another stack can be aligned.
- The dependency-cruiser and Knip configurations load optional
  `.dependency-cruiser.local.mjs` and `knip.local.js`, so a project adapts
  them without editing foundation-owned files.
- `typeScriptCodeHealthRules` lets a project add the foundation's rules to
  its own ESLint configuration without the false positives
  `sonarjs/null-dereference` reports on typed code.
- `premerge` clears its own report directory, fails without a coverage
  report, counts an uncalled one-line function as uncovered and lists changed
  sources outside the coverage scope: the rehearsal had passed with an empty
  report.
- The waves reference carries the steps the rehearsal needed and a worked
  example.

The inventory's TypeScript check follows one relative `extends` level only.
