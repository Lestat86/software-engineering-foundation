# ADR 0020: requirements and feature plans live in the generated project

- **Status:** proposed
- **Date:** 2026-10-05

## Context

A generated project received a short `AGENTS.md` and the lint configuration,
but not the requirements themselves: their identifiers, rationale and
verification method stayed in the foundation repository. A reviewer, human or
agent, working in the project had no criteria to review against.

The analysis done before implementation, where most of the value of planned
work lies, was kept wherever each team happened to put it: in Git, outside the
repository, or in an agent's private memory. Two of the plans examined were not
versioned at all.

## Decision

- Copy every reference to `docs/foundation/`, with a generated `README.md`
  separating the references that apply to the project (shared standards, the
  selected security level, the applied profiles, the CI profile) from those
  present only so that links between references resolve. Filtering the copy
  instead would break those links.
- Treat the copies and the index as foundation-owned assets, so
  `sync-foundation.mjs` keeps them in step with the recorded version.
- Generate `docs/features/` with a plan template and a user interface
  specification template, and a README describing the convention.
- Add `RECORD-PLAN-001` and check every plan in `lint:foundation`: front
  matter, every section, no open blocking question from `ready` on, and every
  acceptance criterion checked, manual with an owner or deferred to an issue
  once `done`.
- Point agents at both in the generated `AGENTS.md`.

## Consequences

A project carries its own review criteria and its own planning record, and an
agent reviewing a pull request needs nothing outside the repository. The plan
check runs with `lint`, so a plan cannot be marked ready with open questions or
done with unverified criteria in any branch or pipeline.

The copy adds about 250 KB of Markdown to each project. Edits to it are
reported as conflicts by the next synchronization, which is intended: project
decisions belong in `docs/exceptions.yml`, plans and `AGENTS.md`.
