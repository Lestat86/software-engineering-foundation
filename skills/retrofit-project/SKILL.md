---
name: retrofit-project
description: Bring an existing TypeScript web project onto the Software Engineering Foundation step by step - inventory, risk classification, gap assessment and a plan of small pull requests in waves, with existing violations frozen in baselines that may only shrink. Use for an existing repository; use bootstrap-web-project for a new one.
---

# Retrofit an existing project

Adopt the foundation without stopping the project: new and changed code meets
the foundation at once, existing violations are frozen in baselines that may
only shrink, and every change ships as a small, separately reviewable pull
request. Work in the assisted mode: you analyze and propose, the person decides.

## Constraints

- Never apply the foundation to the whole codebase in one change.
- Never delete or rewrite a project file outside the wave being implemented,
  and never discard uncommitted work: start each wave on a new branch from the
  branch the person names.
- Mechanical changes, such as autofixes and renames, go in their own commits.
- A deviation the project keeps is recorded in `docs/exceptions.yml`, not left
  implicit.
- Next.js is outside the foundation scope: apply only the stack-independent
  requirements and mark the stack-specific ones not applicable.

## Workflow

1. **Inventory.** Run, read-only:

   ```sh
   node <skill-directory>/scripts/inventory-project.mjs --target <dir>
   ```

   It lists the stack, package manager, ESLint configuration, hooks, CI,
   TypeScript flags, suppressions, debt markers and suspicious tracked files,
   each mapped to a requirement.
2. **Classify the risk** with the person, following the foundation's
   [risk classification](../bootstrap-web-project/references/security/risk-classification.md).
   Record the level and its rationale.
3. **Assess the gaps.** For each requirement of
   [the foundation](../bootstrap-web-project/references/foundation.md), state
   one status: compliant, autofixable, baseline, work needed, not applicable
   or exception proposed. Write the inventory and the assessment to
   `docs/foundation/retrofit-assessment.md` in the project.
4. **Plan the waves** described in [waves](references/waves.md), one plan per
   pull request in `docs/features/retrofit-<n>/plan.md`, from the plan template
   once wave 0 has installed it, and confirm the order with the person.
5. **Implement one wave at a time.** Each wave ends with
   `corepack yarn validate` passing, and from wave 0 on with
   `corepack yarn premerge`, before the next starts.

## Completion

A wave is complete when its pull request is merged with its plan `done`. The
retrofit is complete when `sync-foundation.mjs` reports the project aligned
with no conflict, every baseline is empty or covered by an exception, and the
assessment has no "work needed" item left.
