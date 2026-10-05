# ADR 0015: dependency classes and workspace boundaries are checked by lint

- **Status:** proposed
- **Date:** 2026-10-05

## Context

`STRUCT-BOUNDARY-001`, `STRUCT-SHARED-001` and `DEP-MINIMAL-001` require
explicit module boundaries, shared packages that never import from their
consumers and correct dependency classes. ESLint checks one file at a time:
`import/no-cycle` rejects cycles, but nothing rejected a client importing
server code, a shared package importing an application, production code
importing a test tool or a package used without being declared. In a growing
codebase these are the couplings behind regressions far from the change that
caused them.

## Decision

- Add `dependency-cruiser` to the shared development dependencies and copy a
  `.dependency-cruiser.mjs` to every generated project, run by a new
  `lint:deps` script that `lint` includes.
- Forbid production code under `src/` from importing development dependencies,
  packages that are not declared, packages declared in two dependency classes,
  unresolvable imports and deprecated core modules.
- Forbid imports between `apps/client` and `apps/server` and from `packages/`
  into `apps/`. The rules match nothing in a single-package project, so one
  configuration serves every profile.
- Exempt workspace packages under the project scope from the unresolvable
  rule: they resolve to build output that does not exist before the build, and
  the typecheck verifies them.
- Leave cycles to `import/no-cycle`, which already reports them in the editor
  and at commit, rather than reporting them twice.

## Consequences

A cross-application import or a test tool used in production code fails
`lint`, including in CI. Verification on every generated profile found no
violations; the monorepo tests plant a client-to-server import and a
development dependency import and confirm both are rejected.

Exclusions are anchored to the project's own `dist` and `coverage`
directories: excluding every `dist` path would also hide installed packages,
whose entry points often live in `dist`, and silently disable the dependency
class rules.

Projects add their own boundaries, such as feature internals, as further
`forbidden` entries. The configuration is a copied asset, so foundation
updates reach it through the planned asset synchronization.
