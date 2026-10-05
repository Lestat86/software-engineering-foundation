# ADR 0016: a Fastify route without its contract cannot be registered

- **Status:** proposed
- **Date:** 2026-10-05

## Context

`FASTIFY-SCHEMA-001` requires every route to declare zod schemas for its
input and responses, and `CORE-CONTRACT-001` requires untrusted input to be
validated at the trust boundary. The template's routes complied, but the only
check for a new route was review: a route added without a schema accepted any
body and serialized any response, and every test still passed.

## Decision

- Add `src/plugins/route-contracts.ts` with `enforceRouteContract`, registered
  in `buildApp()` as an `onRoute` hook before any plugin, so it sees every
  route, including those of encapsulated feature plugins.
- Refuse a route that has no response schema, that has path parameters
  without a `params` schema, or that accepts a body (`POST`, `PUT`, `PATCH`)
  without a `body` schema.
- Accept, in place of a body schema, a `config.contractException` stating why
  a streaming or proxy route cannot have one and how its payload is bounded,
  as the requirement's exception allows.
- Cover the hook with template tests that register each kind of incomplete
  route on the built application.

## Consequences

An incomplete route throws at registration, so the application fails to start
in development, in tests and in production; every test that builds the
application exercises the check. Query strings and headers are not required,
because the hook cannot know whether a handler reads them: their validation
remains part of review.

The check runs inside the application rather than in the lint gate, so it
also covers routes registered dynamically. Projects generated earlier gain it
by copying the plugin and adding the hook to `buildApp()`.
