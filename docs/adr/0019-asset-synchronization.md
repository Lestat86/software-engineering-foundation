# ADR 0019: copied foundation assets are synchronized by recorded hashes

- **Status:** proposed
- **Date:** 2026-10-05

## Context

The generator copies the shared tooling into each project: ESLint modules,
TypeScript configurations, hooks, dependency, Knip and secret rules, checks,
request templates and the pipeline. Copies do not update themselves, so every
foundation release left existing projects behind, and nothing told a project
which of its copies it had changed. The repository rule that scripts never
overwrite user files ruled out a blind re-copy.

Publishing the tooling as packages was considered and postponed: it needs a
registry and covers only the ESLint configuration, not hooks, checks or
templates.

## Decision

- `renderFoundationAssets` in the generator lists and renders every
  foundation-owned file. The generator writes them as before and records the
  SHA-256 of each in `.config/foundation/assets.json`, after checking that each
  written file equals its rendering.
- `sync-foundation.mjs` renders the same list for the project's profiles and
  compares three hashes per file: the project's file, the recorded one and the
  new rendering. It replaces only a file whose content still matches its
  record, adds new files, writes `<file>.sef-new` next to a file the project
  changed, and reports deleted and retired files without recreating or
  removing them.
- Dependency versions and root scripts are compared with the profiles and
  reported for manual change, because `package.json` belongs to the project.
- `foundationVersion` in the record moves only when every file, dependency and
  script is aligned. The command reports by default and writes with `--apply`.
- A project without `assets.json` is adopted: identical files are recorded,
  differing ones become conflicts.

## Consequences

Updating a project is a reviewable diff: replaced files are byte-identical to
what a new project would receive, and every local change is preserved and
surfaced. The record is a third copy of each hash next to Git, which is
acceptable for a file the tool owns.

Replacing an untouched file is a controlled exception to the repository rule
that scripts never overwrite user files, recorded in `AGENTS.md`: the hash is
the proof that the file is the foundation's, not the user's.

The record is read from the generator's JSON-compatible YAML lines instead of
with a YAML parser, so the skill keeps no runtime dependency; a record edited
into another YAML style must keep those fields on single lines.
