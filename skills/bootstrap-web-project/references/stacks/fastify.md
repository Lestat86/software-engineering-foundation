# Fastify profile

Use this profile for a TypeScript Fastify backend. Apply it after the
[shared foundation](../foundation.md), the [shared tooling](../tooling.md) and
the selected security profile. The toolchain decisions are recorded in ADR 0006
of the foundation repository.

## Profile asset

The production template lives in `assets/stacks/fastify/`:

| File | Purpose |
| --- | --- |
| `package.json` | Script contract; `dev` and `start` run TypeScript natively through Node type stripping |
| `.env.example` | Configuration names with safe defaults and no secret values |
| `tsconfig.json`, `tsconfig.build.json` | Typecheck with `.ts` extension imports; build rewrites them to `.js` in `dist/` |
| `eslint.config.mjs`, `vitest.config.ts` | Shared ESLint composition and the Node test environment |
| `src/config.ts` | zod schema for the environment; fails fast naming variables, never values |
| `src/app.ts` | `buildApp()` composes the type provider, security, error contract and features |
| `src/server.ts` | Entry point with graceful shutdown through `close-with-grace` |
| `src/plugins/security.ts` | Helmet, CORS allowlist and rate limiting, registered without encapsulation |
| `src/plugins/error-handler.ts` | Stable `{ error: { code, message, issues? } }` contract for every failure |
| `src/plugins/route-contracts.ts` | `onRoute` hook that refuses to register a route without its schemas |
| `src/features/*/routes.ts` | Encapsulated feature plugins with zod request and response schemas |
| `test/build-test-app.ts` | Builds the full application against isolated configuration |

## Files to apply

The skill script performs the file steps below; they are the specification it
implements.

1. Complete the [shared tooling steps](../tooling.md) with `.config/eslint/`
   and `.config/typescript/`.
2. Copy every file of `assets/stacks/fastify/` to the project root and replace
   `{{PROJECT_NAME}}`, `{{YARN_VERSION}}` and `{{NODE_ENGINES}}` as described
   in the [React reference](react.md).
3. Fill `dependencies` and `devDependencies` from the `fastify` profile in
   `versions.json`. Keep every version exact.
4. Replace the demonstration `greetings` feature with the first real feature;
   keep `health`.
5. Install with Corepack and run `corepack yarn validate`, then
   `corepack yarn dev` to confirm the server boots with `.env`.

The profile ships a `.yarnrc.yml` fragment that marks the OpenAPI peers of
`fastify-type-provider-zod` optional. Merge it under the `packageExtensions`
section of the root `.yarnrc.yml` and keep it while the package declares those
peers as required.

## `FASTIFY-SCHEMA-001` — every route declares its contract

- **Level:** MUST
- **Applies to:** Fastify projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Define zod schemas for body, params, querystring, headers
  and each response status through the zod type provider. Request object
  schemas are strict, bound string lengths and collection sizes, and accepted
  schemas are application code; never compile schemas supplied by clients.
- **Rationale:** Schemas validate untrusted input before handlers run, give
  handlers inferred types and let response serialization enforce the output
  contract.
- **Verification:** `enforceRouteContract`, added as an `onRoute` hook in
  `buildApp()` before any plugin, throws at registration when a route has no
  response schema, has path parameters without a `params` schema, or accepts a
  body without a `body` schema; the application therefore cannot start with
  such a route. Route tests send missing, malformed, oversized and unexpected
  fields and expect `VALIDATION_FAILED`.
- **Sources:** [Fastify validation and serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod), `SEC-INPUT-001`.
- **Exceptions:** Streaming or proxy routes document why a body schema cannot
  apply and bound the payload another way, in the route's
  `config.contractException`, which the hook accepts in place of a body
  schema.

## `FASTIFY-PLUGIN-001` — features are encapsulated plugins

- **Level:** SHOULD
- **Applies to:** Fastify projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Organize code by feature under `src/features/`, each
  exposing a route plugin registered in `buildApp()`. Cross-cutting concerns
  such as security, error handling and shared decorators use `fastify-plugin`
  so they apply to the whole instance; feature plugins stay encapsulated.
- **Rationale:** Encapsulation keeps feature state local while shared behavior
  is declared once at the root.
- **Verification:** Review `buildApp()` registrations and confirm hooks and
  handlers added by cross-cutting plugins reach every route in tests.
- **Sources:** [Fastify plugins guide](https://fastify.dev/docs/latest/Guides/Plugins-Guide/), [Fastify encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/), practitioner experience with Fastify services.
- **Exceptions:** A very small service may register routes directly in
  `buildApp()` until a second feature exists.

## `FASTIFY-ERROR-001` — one error contract

- **Level:** MUST
- **Applies to:** Fastify projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep the root error and not-found handlers so every
  response failure has the shape `{ error: { code, message, issues? } }`.
  Client faults preserve their status and a safe message; validation issues
  carry paths and messages but never submitted values; unexpected faults are
  logged with the error and answered as `INTERNAL_ERROR`.
- **Rationale:** Clients can rely on a single contract and internal details
  never leak through default error serialization.
- **Verification:** Tests cover 400, 404, 413, 429 and an injected 500 and
  assert the shape and the absence of stack traces or echoed input.
- **Sources:** [Fastify errors](https://fastify.dev/docs/latest/Reference/Errors/), `CORE-ERROR-001`, `SEC-FAILURE-001`.
- **Exceptions:** None for the shape. Additional safe fields may be added.

## `FASTIFY-SECURITY-001` — protective defaults from validated configuration

- **Level:** MUST
- **Applies to:** Fastify projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Register `@fastify/helmet`, an explicit CORS origin
  allowlist, `@fastify/rate-limit` and a body size limit, all driven by the
  validated configuration. `TRUST_PROXY` is explicit and enabled only behind a
  known proxy. Log redaction covers authorization and cookie headers.
- **Rationale:** These controls bound resource use and remove common
  misconfiguration classes before any feature code exists.
- **Verification:** Tests assert security headers, rate-limit responses and
  body-limit rejection; review the CORS list and proxy setting per environment.
- **Sources:** [@fastify/helmet](https://github.com/fastify/fastify-helmet), [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit), [@fastify/cors](https://github.com/fastify/fastify-cors), `SEC-CONFIG-001`, `SEC-RESOURCE-001`.
- **Exceptions:** Authentication-aware limits and stricter per-route budgets
  are added according to the security profile; the global baseline remains.

## `FASTIFY-RUNTIME-001` — native ESM runtime and reproducible build

- **Level:** MUST
- **Applies to:** Fastify projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Run source with Node type stripping in development, import
  local modules with explicit `.ts` extensions, keep `erasableSyntaxOnly`, and
  build with `tsc` rewriting extensions into `dist/`. Handle `SIGINT` and
  `SIGTERM` with a bounded graceful shutdown.
- **Rationale:** One compiler and no extra loader keep development and
  production behavior aligned, and graceful shutdown lets in-flight requests
  finish during deploys.
- **Verification:** `corepack yarn build` then `corepack yarn start` boots from
  `dist/`; the generated-project test performs the same check.
- **Sources:** [Node.js type stripping](https://nodejs.org/api/typescript.html), [TypeScript `rewriteRelativeImportExtensions`](https://www.typescriptlang.org/tsconfig/#rewriteRelativeImportExtensions), [close-with-grace](https://github.com/mcollina/close-with-grace).
- **Exceptions:** A deployment platform that requires a bundle may add a
  bundler step that consumes `dist/`.
