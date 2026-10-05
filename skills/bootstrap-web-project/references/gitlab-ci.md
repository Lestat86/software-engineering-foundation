# Optional GitLab CI profile

Apply this profile only when the user selects GitLab CI. The decision is
recorded in ADR 0009 of the foundation repository.

## Profile asset

`assets/ci/gitlab/.gitlab-ci.yml` is copied to the project root with
`{{NODE_MAJOR}}` replaced by `runtime.nodeMajor` from `versions.json`. It runs
on merge requests, the default branch and tags:

1. `install`: immutable Yarn installation that populates the project-local
   cache keyed on `yarn.lock`;
2. `verify`: `lint`, `typecheck`, `test` and `build` as parallel jobs, each
   restoring the cache and installing immutably, and GitLab Secret Detection,
   included from the GitLab template, moved to `verify` and inheriting none of
   the Node.js defaults because it runs its own analyzer image.

Every job uses the Node.js image matching the pinned major, invokes Yarn through
Corepack, disables Husky and contains no deployment, environment or release
logic. Record `ci: "gitlab"` in `.engineering-foundation.yml`.

Browser tests, Supabase database tests and other jobs that need browsers or
Docker are added by the project with their own images and are not part of the
baseline.

## `CI-GATE-001` — the pipeline runs the complete gate reproducibly

- **Level:** MUST
- **Applies to:** projects with GitLab CI selected
- **Risk levels:** R1, R2, R3
- **Requirement:** The pipeline installs with `corepack yarn install
  --immutable` on the same Node.js major as `.node-version`, then runs `lint`,
  `typecheck`, `test` and `build` through the root scripts. Jobs never bypass a
  failing check by editing the scripts they call.
- **Rationale:** CI is the only gate that runs on every change independently
  of developer machines and hooks.
- **Verification:** The generated-project test checks the image major, the
  immutable install and the four commands; a merge request pipeline shows all
  four jobs.
- **Sources:** [GitLab CI/CD YAML reference](https://docs.gitlab.com/ci/yaml/), `DEP-LOCK-001`, `DEP-RUNTIME-001`, `GIT-HOOK-001`.
- **Exceptions:** A project without a `build` output may make the `build` job
  a typecheck-only build; it does not remove the job.

## `CI-SECRET-001` — pipelines never print secrets

- **Level:** MUST
- **Applies to:** projects with GitLab CI selected
- **Risk levels:** R1, R2, R3
- **Requirement:** Never echo a secret or authentication variable, dump the
  environment with `env`, `printenv`, `export` or equivalents, or enable shell
  tracing around commands that read secrets. Treat GitLab masking as defense
  in depth, not as permission to print a value. Review pipeline changes before
  exposing protected variables to them.
- **Rationale:** Job logs are widely readable and retained; a printed secret is
  compromised.
- **Verification:** The generated-project test rejects environment dumps and
  tracing in the template; review `script` changes in merge requests.
- **Sources:** [GitLab CI/CD variables](https://docs.gitlab.com/ci/variables/), `CORE-LOG-001`, `GIT-SECRET-001`.
- **Exceptions:** None. GitLab Secret Detection, included by the template,
  complements the secretlint scan of `lint`; neither weakens this requirement.
