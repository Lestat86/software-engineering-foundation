# Dependencies and toolchain standard

## `DEP-YARN-001` — one pinned package manager

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Use Yarn as the sole package manager. New projects pin an
  exact Yarn Modern version in `packageManager`, use Corepack to invoke it and
  configure the `node-modules` linker.
- **Rationale:** Pinning removes package-manager drift while `node-modules`
  preserves compatibility with the selected tool ecosystem.
- **Verification:** Inspect `package.json`, `.yarnrc.yml` and the absence of
  foreign lockfiles; run `corepack yarn --version`.
- **Sources:** [Yarn Corepack](https://yarnpkg.com/corepack), [Yarn linker configuration](https://yarnpkg.com/configuration/yarnrc#nodeLinker).
- **Exceptions:** Existing repositories using Yarn Classic remain unchanged
  unless migration is explicitly in scope; this bootstrap creates new projects.

## `DEP-LOCK-001` — reproducible dependency resolution

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Commit exactly one `yarn.lock`. CI and other reproducible
  environments install with `corepack yarn install --immutable`.
- **Rationale:** A reviewed lockfile and immutable installation make dependency
  resolution repeatable and expose undeclared lock changes.
- **Verification:** Run an immutable install from a clean checkout and confirm it
  leaves the worktree unchanged.
- **Sources:** [Yarn install](https://yarnpkg.com/cli/install), practitioner experience with production TypeScript applications.
- **Exceptions:** None for generated projects.

## `DEP-RUNTIME-001` — pin the runtime contract

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Declare the supported Node.js major version in `engines` and
  in the repository's developer-runtime file. CI and local documentation use
  the same major version.
- **Rationale:** Runtime drift can change module, platform and tool behavior even
  when dependencies are locked.
- **Verification:** Compare `engines`, the runtime-version file, CI image and
  executed `node --version`.
- **Sources:** [Node.js package `engines`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#engines), practitioner experience with production deployments.
- **Exceptions:** A library may declare a tested version range, but every CI job
  must use an explicitly selected version from that range.

## `DEP-MINIMAL-001` — justify production dependencies

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Add a dependency only when its maintained behavior materially
  improves on a small local implementation. Put build and test tools in
  `devDependencies`; do not ship duplicate libraries serving the same role
  without a documented migration need.
- **Rationale:** Every dependency adds supply-chain, maintenance, bundle and
  compatibility cost.
- **Verification:** The `lint:deps` dependency-cruiser rules reject production
  code importing a development dependency, a package used but not declared and
  a package declared in two dependency classes; review new packages for
  purpose, maintenance, license and transitive footprint.
- **Sources:** [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final), practitioner experience with production TypeScript applications.
- **Exceptions:** Temporary duplication during an incremental migration records
  an owner and removal condition.

## `DEP-UPDATE-001` — reviewed dependency changes

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Treat manifest and lockfile updates as code changes. Review
  release and security impact, run the complete validation gate and keep
  unrelated dependency upgrades out of feature changes.
- **Rationale:** Lockfile churn can conceal behavior and supply-chain changes
  that deserve focused review.
- **Verification:** Inspect the manifest and lock diff, review upstream release
  information and run `yarn validate`.
- **Sources:** [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final), practitioner experience with production TypeScript applications.
- **Exceptions:** A tightly coupled framework preset may update a documented set
  of packages atomically.

## `DEP-ESLINT-001` — ESLint owns source formatting

- **Level:** MUST
- **Applies to:** JavaScript and TypeScript projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Use ESLint Flat Config for code quality and JavaScript or
  TypeScript formatting, including `@stylistic` rules. Expose `lint` and
  `lint:fix`; do not install or configure Prettier.
- **Rationale:** One engine avoids overlapping formatting ownership and gives
  developers a single actionable result.
- **Verification:** Inspect dependencies and configuration, run both scripts and
  confirm no Prettier configuration or integration exists.
- **Sources:** [ESLint configuration files](https://eslint.org/docs/latest/use/configure/configuration-files), [`@stylistic` documentation](https://eslint.style/guide/why).
- **Exceptions:** Non-code formats that ESLint cannot safely rewrite may use a
  format-specific tool only after documenting its non-overlapping scope.
