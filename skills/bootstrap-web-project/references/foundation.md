# Shared foundation

Apply this reference to every generated project.

## Required standards

Read and apply every shared standard before generating a project:

- [Core engineering](standards/core.md)
- [TypeScript](standards/typescript.md)
- [Project structure](standards/project-structure.md)
- [Testing](standards/testing.md)
- [Dependencies and toolchain](standards/dependencies.md)
- [Git workflow](standards/git-workflow.md)
- [Project record](standards/project-record.md)

Then apply the [shared tooling implementation](tooling.md).

## Project record

Generate `.engineering-foundation.yml` with the foundation version, selected
profiles, security level, accessibility target, package manager, CI choice and
workflow mode, and an empty `docs/exceptions.yml` register. Both are validated
by `.config/foundation/check-foundation.mjs` as defined in the
[project record standard](standards/project-record.md).

## Updating a project

`.config/foundation/assets.json` records the hash of every foundation-owned
file at generation. From the foundation repository, run:

```sh
node <skill-directory>/scripts/sync-foundation.mjs --target <dir>          # report
node <skill-directory>/scripts/sync-foundation.mjs --target <dir> --apply  # write
```

It updates files the project never changed, adds new ones, writes
`<file>.sef-new` next to files the project changed, reports deleted and
retired files without recreating or removing them, and lists the dependency
and script changes to make by hand. `foundationVersion` in the record moves
only when everything is aligned.

## Required commands

Every generated project exposes consistent Yarn scripts for:

- `lint`, which runs `lint:foundation`, `lint:code`, `lint:deps` and
  `lint:secrets`
- `lint:fix`
- `typecheck`
- `test`
- `build`
- `validate`, which runs the complete local quality gate
- `premerge`, which runs the gate with the changed-code checks before a pull
  request

The exact command contracts and tool choices are defined in the linked
standards. Stack references may extend them but must not weaken them.
