# ADR 0018: unused files, exports and dependencies fail the pre-merge gate

- **Status:** proposed
- **Date:** 2026-10-05

## Context

`CORE-DEBT-001` removes dead code and `DEP-MINIMAL-001` requires every
dependency to earn its place, but neither had a check that sees the whole
project: ESLint reports unused variables inside a file, not an export no other
file imports or a package nothing loads. Agents tend to leave both behind when
they replace an implementation.

Running Knip on the generated projects confirmed the gap in the templates
themselves: the Fastify profile declared `pino-pretty` without using it, and
five exports were used only inside their own module.

## Decision

- Add Knip to the shared development dependencies and run it in `premerge`,
  after `build` and before the coverage step.
- Generate `knip.config.js` whose `ignoreDependencies` names only packages
  Knip cannot trace: tools run by the Git hooks, the secretlint preset and, per
  profile, packages declared before their first import (monorepo workspace
  packages, the Supabase client). The generator writes the profile entries
  only for the profiles applied, so Knip does not report an unnecessary ignore.
- Mark the shared ESLint exports intended as project API with `@public`.
- Fix the templates: remove `pino-pretty`, stop exporting the five
  module-local declarations, and drop the redundant `collection` entry from
  `nest-cli.json`, whose default is the same package.

## Consequences

A branch that leaves an unused file, export or dependency fails `premerge`
with the item to delete. Knip analyzes the whole project, not the diff, so it
also reports debt that existed before the branch; on a new project that is
none, and the retrofit plan freezes an existing backlog first.

Knip runs in `premerge` rather than `lint` to keep the commit-time and editor
loop fast; it is still part of every pull request.
