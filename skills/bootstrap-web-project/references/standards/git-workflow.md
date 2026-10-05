# Git workflow standard

This standard intentionally does not prescribe GitFlow, trunk-based development
or a hosting platform. A project records its chosen branch and release policy
when team or delivery constraints require one.

## `GIT-CHANGE-001` — focused changes

- **Level:** MUST
- **Applies to:** all repositories
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep a commit focused on one coherent purpose. Do not mix
  unrelated refactors, dependency upgrades or generated churn with a behavioral
  change.
- **Rationale:** Focused commits make review, rollback and incident analysis
  safer.
- **Verification:** Review the diff and commit message together; every changed
  file must contribute to the stated purpose.
- **Sources:** Practitioner experience with production TypeScript repositories.
- **Exceptions:** Mechanically generated changes may be separate commits in the
  same review when their provenance is clear.

## `GIT-MESSAGE-001` — machine-readable commit intent

- **Level:** SHOULD
- **Applies to:** all repositories
- **Risk levels:** R1, R2, R3
- **Requirement:** Use Conventional Commits for new commit messages and validate
  them with commitlint in the commit hook.
- **Rationale:** Consistent intent improves history navigation and supports
  future automated release notes without selecting a release process now.
- **Verification:** Run commitlint against proposed commit messages and inspect
  the history for meaningful scopes and descriptions.
- **Sources:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), practitioner experience with Conventional Commits adoption.
- **Exceptions:** Merge and automated dependency commits may follow the hosting
  platform or bot's stable format.

## `GIT-HOOK-001` — hooks are fast feedback

- **Level:** MUST
- **Applies to:** all repositories
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep pre-commit checks limited to fast validation of staged
  or directly affected files. Run the complete `yarn validate` gate independently
  before merge; hooks never replace CI or explicit validation.
- **Rationale:** Fast hooks are used consistently, while full correctness still
  needs repository-wide checks.
- **Verification:** Time the hook on a representative change, inspect its staged
  file scope and compare it with the complete validation command.
- **Sources:** Practitioner experience with Git hook tooling in production repositories.
- **Exceptions:** A very small repository may run its full gate in the hook when
  it remains reliably fast.

## `GIT-BYPASS-001` — bypasses remain exceptional

- **Level:** MUST
- **Applies to:** all repositories
- **Risk levels:** R1, R2, R3
- **Requirement:** Do not normalize `--no-verify` or disabling checks as part of
  routine development. If an emergency bypass is necessary, run the skipped
  checks separately and record any unresolved result in the review.
- **Rationale:** Silent bypasses invalidate the shared quality contract.
- **Verification:** Review contribution documentation and emergency changes for
  evidence that skipped checks were restored or disclosed.
- **Sources:** Practitioner experience with production TypeScript applications.
- **Exceptions:** Recovery from a broken hook is allowed when the change repairs
  the hook and equivalent validation runs before merge.

## `GIT-SECRET-001` — keep sensitive material out of history

- **Level:** MUST
- **Applies to:** all repositories
- **Risk levels:** R1, R2, R3
- **Requirement:** Never commit secrets, credentials, authentication keys,
  production environment files or sensitive customer data. A discovered secret
  is treated as compromised and rotated; deleting the line in a later commit is
  insufficient.
- **Rationale:** Git history and clones persist removed content, expanding the
  exposure beyond the current tree.
- **Verification:** `secretlint` scans staged files in the pre-commit hook and
  every file Git does not ignore as part of `lint`; review environment and
  fixture changes and follow the incident process on detection.
- **Sources:** [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), [GitHub guidance on removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
- **Exceptions:** None for real secret values. Test credentials must be inert,
  isolated and visibly synthetic.
