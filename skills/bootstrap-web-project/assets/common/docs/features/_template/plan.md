---
issue: "#123"
# draft: under analysis; ready: analysis complete, no blocking question;
# in-progress: being implemented; done: merged.
status: draft
# Optional: overrides the project workflow mode for this feature.
# workflow: assisted
# yes or no, and why (SEC-RISK-003): does this feature add authentication,
# sensitive data, privileged actions, integrations or exposure?
risk-reassessment: "no: read-only page over data the user already sees"
---

# Plan — <feature name>

## Goal

<!-- One paragraph: the behavior this feature adds or changes, and why. -->

## Verified context

<!-- Facts the plan relies on, each with its source (`file:line`, API schema,
     ticket). Mark anything not yet checked as "assumed". -->

## Decisions

<!-- Locked decisions, and decisions still to confirm with who decides. -->

## Out of scope

<!-- What this feature deliberately does not touch, even if tempting. -->

## Invariants

<!-- Domain rules the implementation must never break, and the identifiers of
     the foundation requirements it touches, for example CORE-CONTRACT-001. -->

## Files and commits

<!-- The files to create or change, grouped by commit, each commit with its
     Conventional Commits subject. -->

## Acceptance

<!-- One checkbox per criterion, each ending with how it is verified:
     "auto: <test or check>", "manual: <who>" or "deferred: #<issue>". -->

- [ ] <criterion> — auto: <test name>

## Tests

<!-- The cases to automate: happy path, failure paths, edge cases. -->

## Blocking questions

<!-- Questions that must be answered before implementation starts, as list
     items. The plan cannot move to ready while one is listed. -->

## Changes during implementation

<!-- Every divergence between this plan and the code, added while
     implementing: what changed and why. The reviewer reads this section. -->

## Pull request description

<!-- The text for the pull request: what, why, and what to verify manually. -->
