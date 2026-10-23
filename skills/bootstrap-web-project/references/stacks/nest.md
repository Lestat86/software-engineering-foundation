# Nest profile

Use this profile for a TypeScript Nest backend on the Express platform. Apply
it after the [shared foundation](../foundation.md), the
[shared tooling](../tooling.md) and the selected security profile. The
toolchain decisions are recorded in ADR 0006 of the foundation repository.

## Profile asset

The production template lives in `assets/stacks/nest/`:

| File | Purpose |
| --- | --- |
| `package.json`, `nest-cli.json` | Script contract; `nest build` compiles with `tsconfig.build.json` |
| `.env.example` | Configuration names with safe defaults and no secret values |
| `tsconfig.json`, `tsconfig.build.json` | Decorator metadata enabled on top of the shared Node preset |
| `eslint.config.mjs` | Shared composition plus the decorated-class accommodation |
| `vitest.config.mts`, `test/setup.ts` | Vitest with SWC for decorator metadata; test-only environment |
| `src/config/env.ts` | zod validation for `ConfigModule`; fails fast naming variables |
| `src/app.module.ts` | Global config, throttling guard, stable error filter and feature modules |
| `src/app.setup.ts` | `configureApp()` applies Helmet, CORS and strict validation; shared with tests |
| `src/main.ts` | Bootstrap using the validated host and port |
| `src/common/stable-error.filter.ts` | Stable `{ error: { code, message, issues? } }` contract |
| `src/health/`, `src/greetings/` | Capability modules with controller, service, DTO and tests |
| `test/app.e2e.test.ts` | End-to-end tests through `supertest` against the configured application |

## Files to apply

The skill script performs the file steps below; they are the specification it
implements.

1. Complete the [shared tooling steps](../tooling.md) with `.config/eslint/`
   and `.config/typescript/`.
2. Copy every file of `assets/stacks/nest/` to the project root and replace
   `{{PROJECT_NAME}}`, `{{YARN_VERSION}}` and `{{NODE_ENGINES}}` as described
   in the [React reference](react.md). The project stays CommonJS; do not add
   `"type": "module"`.
3. Fill `dependencies`, `devDependencies` and root-level `resolutions` from
   the `nest` profile in `versions.json`. Keep every version exact. In a
   monorepo, resolutions belong to the root manifest, not the workspace.
4. Replace the demonstration `greetings` module with the first real capability;
   keep `health`.
5. Install with Corepack and run `corepack yarn validate`, then
   `corepack yarn dev` to confirm the server boots with `.env`.

## Toolchain notes

- Nest stays on major 11. Nest 12 ships as ESM and its schematics require
  TypeScript 6, while `@nestjs/throttler` and the shared TypeScript 5.9 pin
  target Nest 11. Upgrade the whole set together.
- `@nestjs/platform-express@11.2.3` still requests the vulnerable
  `multer@2.2.0`. The root resolution pins Multer 2.3.0, which contains the
  security fixes. Keep the resolution until Nest declares a safe version;
  remove it only after the Nest build, boot and HTTP tests pass without it and
  the dependency audit remains clean for Multer.
- `vitest.config.mts` uses `unplugin-swc` because Vite's default transform does
  not emit decorator metadata. `test/setup.ts` sets test-only environment
  values before `AppModule` is imported, since `ConfigModule.forRoot` reads the
  environment at import time.
- The shared `consistent-type-imports` rule already skips imports used as
  decorator metadata, so constructor injection keeps working.

## `NEST-VALIDATION-001` — strict DTO validation everywhere

- **Level:** MUST
- **Applies to:** Nest projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep the global `ValidationPipe` with `whitelist`,
  `forbidNonWhitelisted` and `transform` enabled and implicit conversion
  disabled. Every body, query and param is a `class-validator` DTO with
  explicit constraints, including string lengths and collection bounds.
- **Rationale:** Allowlisted, typed input at the controller boundary is the
  first control against injection and mass assignment.
- **Verification:** End-to-end tests send missing, malformed, oversized and
  unexpected fields and expect `VALIDATION_FAILED`; review that no handler
  accepts an untyped body.
- **Sources:** [Nest validation](https://docs.nestjs.com/techniques/validation), [class-validator](https://github.com/typestack/class-validator), `SEC-INPUT-001`.
- **Exceptions:** Raw-body webhooks validate signatures first and parse with an
  explicit schema afterwards.

## `NEST-STRUCTURE-001` — capability modules with thin controllers

- **Level:** SHOULD
- **Applies to:** Nest projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Organize modules around product capabilities. Controllers
  translate transport to use cases and back; business behavior lives in
  injectable services with explicit dependencies. Configuration is read only
  through the validated `ConfigService`.
- **Rationale:** Thin controllers keep transport concerns testable in isolation
  and make services reusable across transports.
- **Verification:** Review controllers for logic beyond mapping; ESLint rejects
  direct `process.env` access outside `src/config/env.ts`.
- **Sources:** [Nest modules](https://docs.nestjs.com/modules), [Nest providers](https://docs.nestjs.com/providers), practitioner experience with Nest services.
- **Exceptions:** Cross-cutting infrastructure may be grouped by technical
  responsibility under `src/common/`.

## `NEST-ERROR-001` — one error contract

- **Level:** MUST
- **Applies to:** Nest projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep the global `StableErrorFilter` so every failure has the
  shape `{ error: { code, message, issues? } }`. Client faults keep their
  status and a safe message; validation issues never include submitted values;
  unexpected faults and 5xx exceptions are logged and answered as
  `INTERNAL_ERROR`.
- **Rationale:** Nest's default exception body varies by exception type and can
  expose implementation details.
- **Verification:** End-to-end tests cover 400, 404, 429 and an injected 500
  and assert the shape and the absence of stack traces or echoed input.
- **Sources:** [Nest exception filters](https://docs.nestjs.com/exception-filters), `CORE-ERROR-001`, `SEC-FAILURE-001`.
- **Exceptions:** None for the shape. Additional safe fields may be added.

## `NEST-SECURITY-001` — protective defaults before routes

- **Level:** MUST
- **Applies to:** Nest projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Apply Helmet, an explicit CORS origin allowlist and the
  global `ThrottlerGuard` through `configureApp()`, which `main.ts` and the
  end-to-end tests share. Configuration comes from the validated environment.
  Add authentication, authorization guards and CSRF protection according to the
  security profile.
- **Rationale:** Sharing the setup function guarantees tests exercise the same
  middleware order as production.
- **Verification:** End-to-end tests assert security headers and throttling;
  review `configureApp()` whenever middleware changes.
- **Sources:** [Nest Helmet](https://docs.nestjs.com/security/helmet), [Nest rate limiting](https://docs.nestjs.com/security/rate-limiting), [Nest CORS](https://docs.nestjs.com/security/cors), `SEC-CONFIG-001`, `SEC-RESOURCE-001`.
- **Exceptions:** None for the baseline. Route-specific throttles may relax or
  tighten limits with a documented reason.

## `NEST-TEST-001` — unit and end-to-end layers

- **Level:** MUST
- **Applies to:** Nest projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Test services and providers with `Test.createTestingModule`
  and test HTTP behavior end to end with `supertest` against an application
  created from `AppModule` and `configureApp()`. Keep `yarn test` free of
  external services; integration with databases uses the profile's documented
  local stack.
- **Rationale:** The end-to-end layer proves validation, filters, guards and
  modules compose correctly, which unit tests cannot show.
- **Verification:** Run `corepack yarn test` in a clean checkout; review that
  new controllers have end-to-end coverage for success and denial paths.
- **Sources:** [Nest testing](https://docs.nestjs.com/fundamentals/testing), [Nest SWC and Vitest](https://docs.nestjs.com/recipes/swc#vitest), `TEST-CONTRACT-001`.
- **Exceptions:** None.
