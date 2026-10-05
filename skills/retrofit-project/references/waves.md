# Retrofit waves

Each wave is one or more small pull requests with their own plan. The order
matters: every wave relies on the checks installed by the previous one. The
steps below were rehearsed on a real project with `frontend/`, `server/` and a
`shared/` folder reached through path aliases; the
[worked example](#worked-example-frontend-server-and-shared-with-aliases)
shows the files that layout needed.

## Wave 0 — safety net, no application code changes

### 1. Package manager, alone in its pull request

The foundation's scripts and hooks assume Yarn Modern through Corepack.

- Add `"packageManager": "yarn@<runtime.yarn in versions.json>"` to the root
  `package.json` and a minimal `.yarnrc.yml`. Do not copy the foundation's
  own `.yarnrc.yml`: its `packageExtensions` fit the foundation's templates,
  not your dependencies.

  ```yaml
  nodeLinker: node-modules
  enableGlobalCache: true
  # Refuse packages published less than a day ago (supply-chain protection).
  npmMinimalAgeGate: 1440
  ```

  `node-modules` is required by native tooling such as Capacitor, which reads
  packages from `node_modules`.
- Add `.yarn/install-state.gz` to `.gitignore`. With the global cache that is
  the only file Yarn writes under `.yarn/`.
- Replace `yarn workspaces run <script>` with
  `yarn workspaces foreach -A --exclude <root package name> run <script>`.
- Move `"prepare": "husky"` to `"postinstall": "husky"`: Yarn Modern does not
  run `prepare`, so the hooks would silently stop installing on new clones.
- Replace `npx` in hooks and scripts with `yarn`.
- In Dockerfiles: `corepack enable`, `yarn install --immutable`, and
  `yarn workspaces focus --production` for production-only images.
- Run `corepack yarn install`, then typecheck, tests, every build target and
  the container images: the regenerated lockfile can resolve new versions.
- Merge it quickly: it conflicts with every open branch that touches
  `package.json` or the lockfile.

### 2. History scan

Scan the whole Git history once with a tool that reads history; the
foundation's `secretlint` only reads the working tree. For example, without
installing anything permanently:

```sh
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest git /repo
```

or a `gitleaks` binary from its releases. Rotate every real secret found:
deleting it from the files does not remove it from history or clones.

### 3. Foundation files

1. Write `.engineering-foundation.yml` (see the worked example). Map each
   workspace directory to the profile closest to its stack; the root has no
   profile when it is not a foundation template.
2. Run `node <foundation>/skills/bootstrap-web-project/scripts/sync-foundation.mjs --target .`,
   review the report, then run it again with `--apply`. It adds every
   foundation-owned file and writes `<file>.sef-new` next to the project's own
   versions.
3. Resolve each `.sef-new`: usually take the foundation's hook files and keep
   the project's own changes elsewhere; delete the `.sef-new` file.
4. Remove the project's configurations that the foundation now provides under
   another name, so each tool has one configuration: `.lintstagedrc*` and
   `lint-staged.config.*` other than `lint-staged.config.mjs`;
   `.commitlintrc*` and `commitlint.config.*` other than
   `commitlint.config.mjs`.
5. Install the tools the report lists as `manual dependency` lines at the
   exact versions shown, at the root:
   `corepack yarn add -D <name>@<version> …`. Lines marked `stack` are the
   versions the foundation verified; upgrading the stack is a separate,
   optional piece of work.
6. Run `sync-foundation.mjs` again until it reports `aligned`.

### 4. Scripts, hooks and checks

- Add the scripts `sync-foundation.mjs` lists as missing: `lint` (running
  `lint:foundation`, `lint:code`, `lint:deps`, `lint:secrets`), `validate` and
  `premerge`, with commands that fit the layout (see the worked example).
- The pre-commit hook runs only `lint-staged`; repository-wide checks belong
  to `validate` (`GIT-HOOK-001`).
- **ESLint.** Keep the project's configuration and add the foundation's rules
  on top, for the same files the project's TypeScript blocks already parse:
  `codeHealthConfigs` with `typeScriptCodeHealthRules` from
  `.config/eslint/base.mjs`. A block that also matches files outside those
  globs, such as `test/`, fails to parse them.
- **dependency-cruiser.** Project additions go in
  `.dependency-cruiser.local.mjs`, never in the foundation's file. With path
  aliases that differ per workspace, run it once per workspace, from the
  workspace directory, with its tsconfig.
- **Knip.** Project options go in `knip.local.js`. Knip evaluates
  configuration files such as `vite.config.ts`: if they read environment
  variables, create the `.env` from `.env.example` before running it.
- **Coverage.** In every workspace with tests, add `@vitest/coverage-v8` at
  **the same version as that workspace's vitest**, and a `coverage` block in
  its vitest configuration with `include` and `exclude`. For sources outside
  the workspace, such as a `shared/` folder tested from `server/`, set
  `allowExternal: true` and write every `include` pattern with a leading
  `**/`; without it the report is empty. `premerge` fails on an empty report.
- **Secrets.** A documentation example that looks like a credential is
  marked on the line before it with `secretlint-disable-next-line` in a
  comment of that file's syntax, for example
  `<!-- secretlint-disable-next-line -->` in Markdown. A real credential is
  removed and rotated instead.

From here the reviewer and the pre-merge gate work on every later pull request.

## Wave 1 — tools with baselines

Turn on the remaining checks, freezing what already violates them:

| Check | Baseline |
| --- | --- |
| ESLint | First fix the existing **warnings** or raise their rules to errors: bulk suppressions freeze errors only, and `--max-warnings=0` fails on any warning. Then `corepack yarn eslint . --suppress-all` writes `eslint-suppressions.json`. New violations fail; fixed ones must be pruned with `--prune-suppressions`, because ESLint fails on stale suppressions. |
| dependency-cruiser | `depcruise-baseline` writes `.dependency-cruiser-known-violations.json`; add `--ignore-known` to `lint:deps`. |
| Stricter TypeScript flags | Enable one workspace at a time, starting with shared code, or keep the flag off with an exception until the wave that fixes it. |
| Knip | Start with targeted `ignore` entries in `knip.local.js` and remove them as the code is cleaned. |

`premerge` fails when `eslint-suppressions.json` or the known-violations file
has more entries than at the merge base, so a baseline can only shrink. The
pull request that creates a baseline is reported, not failed.

## Wave 2 — mechanical fixes

ESLint autofixes, moving literals to constants modules, converting functions
to arrows: separate commits per rule, no behavior change, then prune the
baseline.

## Wave 3 — risk-driven work

The controls of the classified security level that the project lacks, one
pull request per control or per trust boundary, ordered by the impact of the
gap they close. Record whatever is deliberately postponed as an exception.

## Wave 4 — burn the baselines down

Whoever changes a file fixes its frozen violations; targeted pull requests
clean the critical modules first. The retrofit ends when every baseline is
empty or covered by an exception.

## Worked example: frontend, server and shared with aliases

A Yarn workspace project with `frontend/` (React, Vite, Capacitor),
`server/` (Fastify) and a `shared/` folder that is not a package, imported by
both through `@shared/*`, while each workspace maps `@/*` to its own `src/`.

`.engineering-foundation.yml`:

```yaml
foundationVersion: "<version of the foundation checkout>"
profiles: ["react-vite","fastify"]
workspaces: {"frontend":"react-vite","server":"fastify"}
security:
  level: "R2"
  rationale: "<identities, data, actions, exposure, worst credible impact>"
  asvsVersion: "5.0.0"
accessibility: "WCAG 2.2 AA"
packageManager: "yarn@<runtime.yarn>"
ci: "none"
workflow: "assisted"
premerge:
  baseRef: "origin/main"
  diffCoverage: 80
```

Keep every value on one line in this JSON-compatible form:
`sync-foundation.mjs` reads the record line by line.

Root scripts in `package.json`:

```json
{
  "lint": "yarn lint:foundation && yarn lint:code && yarn lint:deps && yarn lint:secrets",
  "lint:code": "eslint . --max-warnings=0",
  "lint:fix": "eslint . --fix --max-warnings=0",
  "lint:foundation": "node .config/foundation/check-foundation.mjs",
  "lint:deps": "yarn workspaces foreach -A --exclude <root package name> run lint:deps",
  "lint:secrets": "secretlint --secretlintignore .gitignore \"**/*\"",
  "test": "yarn workspaces foreach -A --exclude <root package name> run test",
  "typecheck": "yarn workspaces foreach -A --exclude <root package name> run typecheck",
  "validate": "yarn lint && yarn typecheck && yarn test && yarn build",
  "premerge": "yarn lint && yarn typecheck && yarn build && knip --no-progress && node .config/foundation/premerge.mjs",
  "postinstall": "husky"
}
```

In `frontend/package.json` and `server/package.json`:

```json
{
  "lint:deps": "depcruise --config ../.dependency-cruiser.mjs --ts-config tsconfig.json src ../shared/src"
}
```

`.dependency-cruiser.local.mjs`:

```js
export default {
  options: {
    // shared/ is not a package: read dependencies from the nearest
    // package.json instead of combining every package.json up the tree.
    combinedDependencies: false,
  },
}
```

Its first finding was real: `shared/` imports `zod`, which only the
workspaces declare. Make `shared/` a workspace package with its own
`package.json`, or record the decision as an exception.

ESLint, added to the project's own `eslint.config.js`:

```js
import { codeHealthConfigs, typeScriptCodeHealthRules } from './.config/eslint/base.mjs'

// …the project's blocks, then:
{
  files:   [ 'frontend/src/**/*.{ts,tsx}', 'server/src/**/*.ts', 'shared/src/**/*.ts' ],
  extends: [ ...codeHealthConfigs ],
  rules:   typeScriptCodeHealthRules,
},
```

`knip.local.js`, while the project composes only `base.mjs` from the
foundation's ESLint modules:

```js
export default {
  ignore: ['.config/eslint/{node,react,stylistic,typescript}.mjs'],
  ignoreDependencies: ['@stylistic/eslint-plugin', 'globals', 'typescript-eslint'],
}
```

`server/vitest.config.ts`, where the server's tests also cover `shared/`:

```ts
coverage: {
  provider:      'v8',
  allowExternal: true,
  include:       [ '**/server/src/**/*.ts', '**/shared/src/**/*.ts' ],
  exclude:       [ '**/*.test.ts', 'src/index.ts' ],
},
```
