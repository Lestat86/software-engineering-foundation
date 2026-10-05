# ADR 0014: the project record and the exception register are checked

- **Status:** proposed
- **Date:** 2026-10-05

## Context

`.engineering-foundation.yml` records the applied profiles and the security
classification, but nothing read it after bootstrap. A project could add
authentication while still recorded as R1, or switch package manager, and the
record would silently disagree with the code.

Governance requires every exception to a MUST requirement to record its
identifier, scope, justification, owner and review date, but gave no place for
the record and no check. An exception without an end date becomes permanent.

Projects are developed in two modes: `assisted`, where people review every
pull request, and `autonomous`, where review is automated. Thresholds and the
review loop planned for later releases depend on the mode, so it has to be
recorded where tools can read it.

## Decision

- Add the project record standard with `RECORD-MANIFEST-001` and
  `RECORD-EXCEPTION-001`.
- Record the workflow mode in the manifest as `workflow: assisted` or
  `workflow: autonomous`, selected with `--workflow` and defaulting to
  `assisted`.
- Generate an empty `docs/exceptions.yml` register.
- Copy `check-foundation.mjs` to `.config/foundation/` with a
  `requirements.json` that maps every requirement identifier of the references
  to its level. The script validates the manifest fields, compares
  `packageManager` with `package.json`, rejects incomplete exceptions, unknown
  identifiers, invalid dates and expired entries, and warns when an R1 project
  depends on an authentication or payment library.
- Split `lint` into `lint:foundation`, `lint:code` and `lint:secrets`, and run
  all three from `lint`, so `validate` and the CI `lint` job include the check.
- Add `yaml` to the shared development dependencies to parse both files.

## Consequences

An expired exception fails the gate on the day after its expiry, which makes
every exception a scheduled review. A record that drifts from `package.json`
fails immediately. The R1 warning is a heuristic based on dependency names: it
prompts a reassessment and never blocks.

`requirements.json` is a snapshot of the identifiers at generation time. A
foundation update that adds requirements must refresh it, which the planned
asset synchronization will do.

Projects generated earlier have no `workflow` field and no register. Adopting
this version means adding both, which the planned retrofit covers.
