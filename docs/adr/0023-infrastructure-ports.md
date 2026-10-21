# ADR 0023: infrastructure behind project-owned ports

- **Status:** proposed
- **Date:** 2026-10-21

## Context

The foundation organizes code by capability (`STRUCT-FEATURE-001`) and asks
for deliberate module surfaces (`STRUCT-BOUNDARY-001`), but nothing stops a
feature from importing an ORM client, a queue library or a cloud SDK
directly. When that happens, the vendor's types spread into signatures and
tests, and replacing a provider, a driver or an ORM touches every caller. The
pilot project hit this while moving from a VPS to a serverless platform: its
queue interface exposed the ORM's transaction type and every interface
between its flows carried generated ORM enums, so a queue change became a
change to every flow.

## Decision

- Add `STRUCT-PORT-001`, a MUST for every risk level: each infrastructure
  service is reached only through a port the project owns, with domain types
  in its signature. Vendor packages are imported by adapters and by the
  composition root only.
- Keep it minimal: one production adapter per port, plus a local or in-memory
  adapter where development or tests need one. No second production adapter
  until a second provider is real. Data access is a set of functions named
  after domain operations, not a generic repository; transactions go through
  a unit-of-work port with an opaque handle.
- The application framework (Fastify, Nest, React) is the shape of the code,
  not a port, and is not abstracted.
- Verify it in `lint:deps` with an `infrastructure-only-in-adapters` rule in
  the foundation's dependency-cruiser configuration: a foundation list of
  infrastructure packages may be imported, type-only imports included, only
  from `src/infrastructure/`, `src/db/` or `src/adapters/`. Projects extend
  the package list and the adapter paths through `ports` in
  `.dependency-cruiser.local.mjs`.
- Amend the Supabase reference so its client is created in an adapter.

## Consequences

- Projects that import an infrastructure package from feature code fail
  `lint:deps` until the import moves into an adapter or the path is declared;
  the change belongs to the 3.0.0 release.
- Contract tests per port, run against every adapter, replace mocks of vendor
  clients, which `TEST-DOUBLE-001` already discourages.
- The package list is a heuristic: a package missing from it is still subject
  to the requirement through review, and projects add their own.
