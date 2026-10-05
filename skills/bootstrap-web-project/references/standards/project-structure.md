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
