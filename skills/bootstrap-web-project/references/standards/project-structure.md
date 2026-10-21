# Project structure standard

## `STRUCT-SHAPE-001` — smallest suitable repository shape

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Use a single application layout for frontend-only or
  backend-only projects. A combined frontend and backend uses `apps/client`,
  `apps/server` and `packages/shared`.
- **Rationale:** A monorepo is useful when it represents real application
  boundaries, but needless workspace structure adds navigation and tooling cost.
- **Verification:** Compare the selected bootstrap profile with the top-level
  layout and workspace declarations.
- **Sources:** Practitioner experience with single-application and monorepo layouts.
- **Exceptions:** A documented deployment or ownership boundary may require a
  different application or package split.

## `STRUCT-FEATURE-001` — organize application code by capability

- **Level:** SHOULD
- **Applies to:** application source code
- **Risk levels:** R1, R2, R3
- **Requirement:** Group code primarily by product capability or domain, with
  technical layers nested inside when helpful. Keep code that changes together
  close together.
- **Rationale:** Capability-oriented modules make ownership and change impact
  clearer than large global folders divided only by technical type.
- **Verification:** Follow a representative feature change and count unrelated
  top-level areas it must touch; review catch-all component, service and utility
  directories.
- **Sources:** Practitioner experience with capability-oriented codebases, Nest official architecture guidance.
- **Exceptions:** Truly cross-cutting infrastructure may be grouped by technical
  responsibility.

## `STRUCT-BOUNDARY-001` — explicit module boundaries

- **Level:** MUST
- **Applies to:** applications and shared packages
- **Risk levels:** R1, R2, R3
- **Requirement:** Expose a deliberate public surface for each module or package.
  Consumers do not deep-import private implementation files or create circular
  dependencies.
- **Rationale:** Stable boundaries allow internals to evolve independently and
  prevent accidental coupling.
- **Verification:** `import/no-cycle` in ESLint rejects cycles; the
  `lint:deps` dependency-cruiser rules reject imports between the client and
  server applications and unresolvable imports; review package exports and
  feature entrypoints.
- **Sources:** [Node.js package entry points](https://nodejs.org/api/packages.html#package-entry-points), practitioner experience with workspace boundaries.
- **Exceptions:** Tests may access a private seam only when no public behavior
  can expose the required invariant; record why.

## `STRUCT-PORT-001` — infrastructure behind project-owned ports

- **Level:** MUST
- **Applies to:** applications that use infrastructure services: databases and
  ORMs, queues and schedulers, storage, email, logging, payments, identity
  providers and cloud SDKs
- **Risk levels:** R1, R2, R3
- **Requirement:** Reach each infrastructure service only through a port the
  project owns: a module whose exported functions and types use domain names
  and domain types, never the vendor's. Vendor packages are imported only by
  the adapters behind a port and by the composition root that wires them.
  Each port has one production adapter and, where development or tests need
  it, a local or in-memory adapter; add a second production adapter only when
  a second provider is real. Data access is a set of functions named after
  domain operations, and transactions go through a unit-of-work port whose
  handle is opaque to callers. The application framework (Fastify, Nest,
  React) is the shape of the code, not a port.
- **Rationale:** Replacing a provider, a driver or an ORM then changes only its
  adapter; callers and their tests keep working, and vendor types cannot
  spread through signatures.
- **Verification:** The `infrastructure-only-in-adapters` dependency-cruiser
  rule rejects imports, type-only imports included, of the foundation's list
  of infrastructure packages outside `src/infrastructure/`, `src/db/` and
  `src/adapters/`; projects add packages and adapter paths through `ports` in
  `.dependency-cruiser.local.mjs`. Review checks that port signatures carry
  domain types and that each port has a contract test run against every
  adapter.
- **Sources:** [Alistair Cockburn, Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/), [Martin Fowler, Unit of Work](https://martinfowler.com/eaaCatalog/unitOfWork.html), [`TEST-DOUBLE-001`](testing.md), practitioner experience with provider migrations.
- **Exceptions:** A library mounted as a framework extension, such as an
  authentication library with its own database adapter, may keep its vendor
  imports inside its own folder, declared as an adapter path with the reason.
  Generated clients are confined the same way.

## `STRUCT-SHARED-001` — evidence before sharing

- **Level:** MUST
- **Applies to:** monorepos and applications with shared modules
- **Risk levels:** R1, R2, R3
- **Requirement:** Move code into `shared`, `common` or a workspace package only
  when it has multiple real consumers and one coherent responsibility. Shared
  contracts contain portable types and schemas, not runtime-specific internals.
- **Rationale:** Premature sharing creates a dependency hub and couples otherwise
  independent features.
- **Verification:** The `no-package-to-app` dependency-cruiser rule in
  `lint:deps` rejects an import from a workspace package into an application;
  review each shared module's consumers.
- **Sources:** Practitioner experience with shared workspace packages.
- **Exceptions:** A stable cross-application contract may be established before
  its second consumer when that consumer is part of an approved near-term plan.

## `STRUCT-COLOCATE-001` — colocate feature support files

- **Level:** SHOULD
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep feature-specific tests, fixtures, schemas and types near
  the code they support. Use global test or type directories only for genuinely
  cross-cutting material.
- **Rationale:** Colocation improves discoverability and makes incomplete moves
  or deletions less likely.
- **Verification:** Review whether support files can be found from their subject
  without repository-wide searching.
- **Sources:** Practitioner experience with colocated tests and fixtures.
- **Exceptions:** Test-runner conventions may require dedicated locations for
  end-to-end suites or global setup.

## `STRUCT-NAME-001` — names describe domain purpose

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Name modules, files and symbols for their domain role. Avoid
  new catch-all names such as `utils`, `helpers`, `misc` or `common` when a more
  specific responsibility exists.
- **Rationale:** Precise names make navigation possible without reading every
  implementation and discourage unrelated accumulation.
- **Verification:** Review newly introduced generic containers and confirm each
  has a single describable responsibility.
- **Sources:** Practitioner experience with production TypeScript applications.
- **Exceptions:** Established framework filenames and narrow conventional
  utilities may retain their ecosystem names.
