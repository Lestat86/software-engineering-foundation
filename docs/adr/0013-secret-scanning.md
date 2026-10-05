# ADR 0013: secrets are scanned by the commit hook and the lint gate

- **Status:** proposed
- **Date:** 2026-10-05

## Context

`GIT-SECRET-001` forbids committing secrets and asked for "staged-file secret
detection where available", but the generated project shipped none. The only
detection was an optional GitLab template, commented out in the CI baseline,
and only for projects that select CI. A committed secret is compromised the
moment it reaches a remote: removing it in a later commit does not remove it
from history or from clones.

Agents commit more often than people and do not hesitate before staging a file
that happens to contain a credential copied from a terminal or a log.

## Decision

- Use `secretlint` with `@secretlint/secretlint-rule-preset-recommend`,
  configured by a `.secretlintrc.json` copied with the Git tooling. It is a
  Node package installed through Yarn like the rest of the toolchain, so it
  needs no binary outside the dependency matrix. Tools that ship as standalone
  binaries, such as gitleaks, were not chosen for this reason.
- Scan every staged file, whatever its type, in `lint-staged`.
- Extend the `lint` script with
  `secretlint --secretlintignore .gitignore "**/*"`, so `validate`, the CI
  `lint` job and any local run scan every file Git can commit. Reusing
  `.gitignore` keeps the scope to committable content; a local `.env` is not
  scanned because it cannot reach history.
- Apply the same scan to this repository.

## Consequences

A staged credential matching one of the preset's rules fails the commit, and a
committable one fails `lint`. Findings are masked in the output, so the scan
does not print what it found. The generated templates, including
`.env.example` files, pass the scan; the Fastify generation test plants a
token at runtime to confirm detection, masking and the ignore scope.

The scan covers the working tree, not history. Adopting the foundation on an
existing repository therefore needs a one-off history scan, planned as part of
the retrofit, and any secret it finds must be rotated.

Detection is pattern-based: a credential with no recognizable shape is not
found, so review and `CORE-LOG-001` remain necessary. Commits bypassing the
hook with `--no-verify` are still caught by `lint`, and by CI when it is
enabled.
