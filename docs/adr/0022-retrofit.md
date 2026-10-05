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

`sync-foundation.mjs` compares exact dependency versions with the profiles, so
a retrofitted project stays "not aligned" until its versions match or the
difference is recorded as an exception. The inventory's TypeScript check
follows one relative `extends` level only.
