# Shared tooling implementation

This reference turns the normative foundation into files that can be copied to
a generated project. Read it for every profile.

## Compatibility snapshot

The exact versions live in
[`assets/tooling/versions.json`](../assets/tooling/versions.json). They were
verified against the npm registry on 2026-09-10.

- ESLint remains on major 9 because the selected React, accessibility and
  import plugins do not yet share support for ESLint 10.
- TypeScript remains on 5.9 because `typescript-eslint` 8 supports TypeScript
  versions below 6.1, while TypeScript 7 is already published.
- Vite stays on 8.2.2 and React on 19.2.8 because the newer releases were
  published less than 24 hours before verification and are held by the Yarn
  package-age gate; `@vitejs/plugin-react` 6 requires Vite 8 and Vitest 5
  supports it.
- jsdom stays on 29 because jsdom 30 requires Node 24.15 while the foundation
  pins only the Node major. Raise both together.
- Nest stays on 11 because Nest 12 schematics require TypeScript 6 and
  `@nestjs/throttler` targets Nest 11; zod stays on 4.5 because 4.6 was held
  by the package-age gate at verification.
- Upgrade the matrix as a focused dependency change. Verify peer ranges, run
  the representative config tests and run `yarn validate`; do not advance one
  major in isolation.

Exact manifest versions and a committed Yarn lockfile make a generated project
reproducible. They do not replace periodic dependency and vulnerability review.
Keep Yarn's package-age gate enabled; if a selected version is quarantined,
prefer the newest compatible version old enough to pass rather than bypassing
the gate.

The shared `.yarnrc.yml` contains a documented `packageExtensions` workaround
for peers omitted by `@commitlint/load`, and keeps `packageExtensions` as its
last section so a profile can contribute its own entries through a
`.yarnrc.yml` fragment. Re-check and remove each workaround when upgrading the
package it patches; do not accumulate unexplained package extensions.

## Files to apply

`scripts/generate-project.mjs` performs the steps in this section and in the
stack references deterministically; run it as described in the skill workflow.
The steps stay written out because they are the specification the script
implements and the fallback when it cannot run. The script never deletes or
overwrites existing files.

For every JavaScript or TypeScript project:

1. Copy `.node-version` and `.yarnrc.yml` from `assets/common/` to preserve the
   runtime major, `node-modules` linker and 24-hour package-age gate.
2. Copy the modules listed under `eslintModules` for the selected profiles in
   `assets/tooling/versions.json` from `assets/tooling/eslint/` into
   `.config/eslint/`. An unused module would import plugins the project does
   not install.
3. Compose them from a root `eslint.config.mjs`. Always include `base.mjs` and
   `stylistic.mjs`; TypeScript projects also include `typescript.mjs`.
4. Copy the applicable files from `assets/tooling/typescript/`.
5. Copy `assets/tooling/git/commitlint.config.mjs` and
   `assets/tooling/git/lint-staged.config.mjs` when Conventional Commits is
   selected, then copy both hooks. If the documented exception to
   `GIT-MESSAGE-001` is used, omit commitlint and the `commit-msg` hook only.
6. Merge the dependency groups listed for the selected profiles under
   `profiles` in `assets/tooling/versions.json`: each profile names its
   `template` directory, its runtime `dependencies` groups and its
   `devDependencies` groups. Overlay profiles such as `supabase` are applied
   after a base profile. Then create the scripts below.
7. Add `"postinstall": "husky"` and ensure Git records the hook source files as
   executable.
8. After generating the files but before installing dependencies, run
   `node <skill-directory>/scripts/ensure-git-root.mjs <target>`. The script
   initializes Git only when the target is not already its own repository root.
   This includes a target nested inside another repository: never let Husky
   configure the containing repository.
9. Install once. Yarn Modern does not run `prepare`, so `postinstall` is the
   install hook that wires Husky. Yarn's default `enableScripts: false` disables
   third-party install scripts only; the project's own `postinstall` still runs
   and the templates need no third-party build script. If `HUSKY=0` was set or
   lifecycle scripts were skipped, run `corepack yarn husky` once afterwards.
10. Verify activation, not only hook file permissions:
    `git config --local --get core.hooksPath` must print `.husky/_`, and
    `.husky/_/h` and an executable `.husky/_/pre-commit` must exist. If any
    check fails, run `corepack yarn husky` and verify again.

React profiles include `react.mjs` and the Vite refresh configuration; Node
backends and Node-run configuration or test files include `node.mjs` with
deliberately scoped file globs. Each stack reference describes its template and
composition: [React](stacks/react.md), [Fastify](stacks/fastify.md),
[Nest](stacks/nest.md) and [Supabase](stacks/supabase.md); the
[monorepo reference](monorepo.md) composes them under one root.

## Script contract

Use these root scripts, adjusting workspace delegation without changing their
public names:

```json
{
  "lint": "yarn lint:foundation && yarn lint:code && yarn lint:secrets",
  "lint:code": "eslint . --max-warnings=0",
  "lint:fix": "eslint . --fix --max-warnings=0",
  "lint:foundation": "node .config/foundation/check-foundation.mjs",
  "lint:secrets": "secretlint --secretlintignore .gitignore \"**/*\"",
  "typecheck": "tsc --noEmit",
  "validate": "yarn lint && yarn typecheck && yarn test && yarn build",
  "postinstall": "husky"
}
```

`lint-staged` runs `eslint --fix --max-warnings=0` only for staged JavaScript
and TypeScript files, and `secretlint` for every staged file. The pre-commit
hook does not run repository-wide typechecking or tests. The complete gate runs
explicitly before merge and in CI when CI is enabled.

## Secret scanning

For [`GIT-SECRET-001`](standards/git-workflow.md), `secretlint` with
`@secretlint/secretlint-rule-preset-recommend`, configured in
`.secretlintrc.json`, scans every staged file in the pre-commit hook and every
file that Git does not ignore as part of `lint`. Reusing `.gitignore` as the
scan's ignore list keeps the scope to what can be committed: a local `.env`
stays out of the scan because it stays out of history. Findings are masked in
the output, so the scan never prints the value it found. A detected secret is
treated as compromised and rotated; removing it from the file is not enough.

## Style baseline

The preset uses two-space indentation, single quotes, no semicolons, trailing
commas where valid in multiline syntax and a 100-column code limit with
pragmatic exceptions for URLs and unbreakable literals. It avoids visual
alignment rules that cause unrelated diff churn.

Formatting rules apply only to JavaScript, TypeScript and JSX/TSX. Do not add
Prettier for JSON, Markdown or YAML; preserve those formats deliberately or add
a format-specific non-overlapping validator through a documented exception.

## Code form baseline

The preset enforces the two code-form invariants of the shared standard.

For [`CORE-ARROW-001`](standards/core.md), `func-style`,
`prefer-arrow-callback` and a `no-restricted-syntax` selector reject,
respectively, a function declaration, a `function` callback and a function
expression bound to a variable. The selector excludes generators, which have no
arrow form. `no-restricted-syntax` is an array rule: a project that adds its own
entry replaces the shared one rather than extending it, so it must repeat the
selector exported as `arrowFunctionRules` from `base.mjs`.

For [`CORE-CONSTANT-001`](standards/core.md), `no-magic-numbers` and its
typed counterpart reject inline literals other than `-1`, `0`, `1` and array
indices, in object values as well as in expressions, and require the value to
be bound to a `const`. Enum members, numeric literal types and readonly class
properties are already named declarations and stay exempt.
`@typescript-eslint/naming-convention` requires `UPPER_SNAKE_CASE` for every
export of a `*.constants.ts` module.

Literal checking is off in the files that are themselves declarations of their
values: `*.test.*` and `*.spec.*`, `test/` and `e2e/` directories, `*.config.*`
and everything under `.config/`. The arrow requirement stays on in all of them.
Extend the exempt globs through the `literalExemptFiles` option, spreading the
exported `defaultLiteralExemptFiles` so the shared entries survive.

## Code health baseline

`base.mjs` exports `codeHealthConfigs` and `codeHealthRules`, which both the
JavaScript and the TypeScript configuration apply to every source file.

- For [`CORE-SUPPRESS-001`](standards/core.md), the
  `@eslint-community/eslint-comments` recommended rules and `require-description`
  reject a disable directive without named rules or without a reason after
  `--`. `reportUnusedDisableDirectives` already rejects stale directives.
- For [`CORE-DEBT-001`](standards/core.md), the local
  `foundation/todo-issue-reference` rule rejects a `TODO` or `FIXME` that does
  not reference an issue as `TODO(#123)`, and `sonarjs/no-commented-code`
  rejects commented-out code. A project with another tracker passes its
  reference pattern as the rule option, for example
  `['error', { reference: '[A-Z]+-\\d+' }]`. The SonarJS `todo-tag` and
  `fixme-tag` rules are off because they reject tracked markers too.
- For [`CORE-COMPLEXITY-001`](standards/core.md),
  `sonarjs/cognitive-complexity` allows 15 per function and `max-depth` allows
  four nested blocks.
- The SonarJS recommended rules add bug-pattern, security-hotspot and
  code-smell checks. Its settings are not applied, so they cannot override the
  React version detection. In TypeScript files `sonarjs/null-dereference` is
  off: it ignores types, and `strictNullChecks` proves nullability exactly.

A security-hotspot rule such as `sonarjs/no-os-command-from-path` marks code to
review, not necessarily a defect. When the reviewed code is correct, keep the
rule and suppress the single site with its reason, as `CORE-SUPPRESS-001`
requires; the suppression records that the hotspot was reviewed.

## Deliberate boundaries

The preset enforces typed linting, promise safety, documented TypeScript and
ESLint suppressions, tracked debt markers, bounded complexity, import validity,
React Hooks and strict JSX accessibility. It does
not prescribe domain naming prefixes, file-per-type organization, universal
named exports, class bans, inline-handler bans or coverage percentages.

Pass design-system component and attribute mappings to `createReactConfig` so
the accessibility plugin understands wrappers around native controls. Static
linting supplements but never replaces the accessibility testing requirements.
