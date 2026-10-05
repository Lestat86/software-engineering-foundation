# Testing standard

## `TEST-CONTRACT-001` — every project has a working test command

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Expose `yarn test` as the stable entrypoint for the project's
  automated tests. It must exit non-zero on failure and be usable without
  production credentials or services.
- **Rationale:** A consistent contract lets developers, agents and CI verify
  projects without rediscovering stack-specific commands.
- **Verification:** Run `corepack yarn test` in a clean checkout with documented
  test prerequisites only.
- **Sources:** Practitioner experience with production test suites.
- **Exceptions:** Tests may use isolated local services or emulators when their
  startup and teardown are automated or explicitly documented.

## `TEST-BEHAVIOR-001` — assert observable behavior

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Test observable inputs, outputs, state transitions and
  side-effects rather than private implementation details. Use the lowest-cost
  test level that gives confidence across the relevant boundary.
- **Rationale:** Behavior-focused tests survive safe refactoring and diagnose
  broken contracts rather than harmless structural changes.
- **Verification:** Review assertions and mocks; refactoring internals without a
  behavior change should not require widespread test rewrites.
- **Sources:** Practitioner experience with behavior-focused test suites.
- **Exceptions:** A focused unit test may target a complex pure algorithm whose
  public integration makes failures difficult to localize.

## `TEST-CHANGE-001` — changed behavior carries evidence

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Add or update automated tests for new behavior and changed
  contracts. A bug fix includes a regression test that fails for the original
  defect whenever the behavior is practically automatable.
- **Rationale:** Tests preserve the reason for a change and prevent known defects
  from returning unnoticed.
- **Verification:** `corepack yarn premerge` fails when the statement lines a
  branch changes are covered below `premerge.diffCoverage` in
  `.engineering-foundation.yml`; review the change and its tests together and
  reproduce a fixed defect against the regression test when risk justifies
  it.
- **Sources:** Practitioner experience with production TypeScript applications.
- **Exceptions:** If automation is impractical, record the manual verification,
  why automation is disproportionate and any follow-up needed.

## `TEST-DETERMINISM-001` — deterministic and isolated execution

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Control time, randomness, network calls and mutable external
  state. Tests must be order-independent and clean up state they create.
- **Rationale:** Deterministic suites are trustworthy quality gates and do not
  waste effort on environmental failures.
- **Verification:** Run suites repeatedly and in randomized or isolated order
  where supported; inspect tests for uncontrolled remote calls and shared state.
- **Sources:** Practitioner experience with environment-dependent test suites.
- **Exceptions:** Explicit end-to-end checks against a managed environment must
  be separately selectable, non-destructive and clearly report prerequisites.

## `TEST-DOUBLE-001` — mock only owned seams

- **Level:** SHOULD
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Prefer real domain collaborators and lightweight fakes. Mock
  at process, network, clock or other owned boundaries rather than reproducing
  the internals of the unit under test.
- **Rationale:** Excessive mocking makes tests pass against an invented system
  while hiding integration failures.
- **Verification:** Review whether each test double replaces an external or
  deliberately designed seam and whether its contract is independently tested.
- **Sources:** Practitioner experience with production TypeScript applications.
- **Exceptions:** Interaction assertions are appropriate when the interaction
  itself is the public behavior, such as emitting an audit event exactly once.

## `TEST-COVERAGE-001` — risk-based coverage, no universal percentage

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Cover critical user journeys, authorization decisions, data
  transformations and failure paths according to risk. Do not treat a single
  repository-wide coverage percentage as proof of quality or impose one
  universal threshold across all profiles.
- **Rationale:** Line coverage cannot show that important behavior is asserted,
  and uniform thresholds reward low-value tests.
- **Verification:** Map tests to material behaviors during review; use coverage
  reports to find blind spots rather than as the sole acceptance criterion.
- **Sources:** Practitioner experience with coverage-driven test suites; risk model
  from OWASP ASVS.
- **Exceptions:** A project may add justified per-package or changed-code
  thresholds as an additional signal.
