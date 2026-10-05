# User manual

How to create a project with the Software Engineering Foundation, what it
checks, and what to do when a check fails. The normative requirements live in
[`skills/bootstrap-web-project/references/`](../skills/bootstrap-web-project/references/);
this manual explains how to work with them day to day.

## Contents

- [Before you start](#before-you-start)
- [Install the skill](#install-the-skill)
- [Create a project](#create-a-project)
- [What a generated project contains](#what-a-generated-project-contains)
- [Everyday commands](#everyday-commands)
- [What is checked, and when](#what-is-checked-and-when)
- [When a check fails](#when-a-check-fails)
- [Recording an exception](#recording-an-exception)
- [Workflow modes](#workflow-modes)
- [Updating a project to a new foundation version](#updating-a-project-to-a-new-foundation-version)
- [Further reading](#further-reading)

## Before you start

- Node.js 24, the version pinned in `.node-version`.
- Corepack enabled once per machine: `corepack enable`. Every command below
  runs Yarn through Corepack, at the version pinned in `package.json`.
- Git.

The foundation supports TypeScript projects built with React and Vite,
Fastify, Nest and Supabase, as a single package or as a full-stack monorepo.
Next.js is out of scope.

## Install the skill

The `bootstrap-web-project` skill is a self-contained directory. Make it
available to your agent:

- **Claude Code, for every project:** copy or link
  `skills/bootstrap-web-project` to `~/.claude/skills/bootstrap-web-project`.
- **Claude Code, for one project:** copy or link it to
  `.claude/skills/bootstrap-web-project` in that project.
- **Other agents:** point the agent at
  `skills/bootstrap-web-project/SKILL.md`; every document is plain Markdown.

## Create a project

Ask the agent to bootstrap a project, for example: *"Create a Fastify API with
Supabase, authenticated users, GitLab CI."* The skill asks what it cannot infer
and then runs the generator. You can also run it yourself:

```sh
node skills/bootstrap-web-project/scripts/generate-project.mjs \
  --target ../my-api --name my-api \
  --profile fastify --profile supabase \
  --security-level R2 --security-rationale "Authenticated API handling customer data." \
  --ci gitlab --workflow assisted
node skills/bootstrap-web-project/scripts/ensure-git-root.mjs ../my-api
cd ../my-api && corepack yarn install && corepack yarn validate
```

| Option | Meaning |
| --- | --- |
| `--target` | Directory to create. It must not exist or must be empty; the generator never overwrites anything. |
| `--name` | Package name, lowercase, without a scope. |
| `--profile` | `react-vite`, `fastify`, `nest`, `monorepo`; `supabase` is an overlay added after a base profile. |
| `--client`, `--server` | Workspace profiles of a `monorepo`: `react-vite` and `fastify` or `nest`. |
| `--security-level` | `R1`, `R2` or `R3`. Any authentication or non-public data means at least `R2`; see the [risk classification](../skills/bootstrap-web-project/references/security/risk-classification.md). |
| `--security-rationale` | Why that level: identities, data, actions, exposure, worst credible impact. |
| `--ci` | `gitlab` to add the GitLab pipeline; omitted means no CI. |
| `--workflow` | `assisted` (default) or `autonomous`; see [Workflow modes](#workflow-modes). |
| `--html-lang` | Language of the React document, default `en`. |

`ensure-git-root.mjs` makes the new directory its own Git repository, so the
hooks are never installed into a parent repository.

## What a generated project contains

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Instructions for any coding agent working in the project. |
| `.engineering-foundation.yml` | The project record: foundation version, profiles, security level and rationale, CI, workflow mode. |
| `docs/exceptions.yml` | The register of exceptions to foundation requirements, empty at first. |
| `.config/eslint/` | The shared ESLint modules, composed by `eslint.config.mjs`. |
| `.config/typescript/` | The shared strict TypeScript configurations. |
| `.config/foundation/` | The record and exception checker and the list of known requirement identifiers. |
| `.dependency-cruiser.mjs` | Dependency class and boundary rules. |
| `.secretlintrc.json` | Secret scanning rules. |
| `.husky/`, `commitlint.config.mjs`, `lint-staged.config.mjs` | Git hooks: commit message and staged-file checks. |
| `.gitlab-ci.yml` | Only with `--ci gitlab`. |

Files under `.config/` and the dotfiles above are copied from the foundation.
Prefer extending them through the options they export, such as
`literalExemptFiles` or extra `forbidden` entries, over editing them, so a
later foundation update can tell your changes from its own.

## Everyday commands

| Command | What it does |
| --- | --- |
| `corepack yarn lint` | Every static check: `lint:foundation`, `lint:code`, `lint:deps`, `lint:secrets`. |
| `corepack yarn lint:fix` | ESLint with automatic fixes. |
| `corepack yarn typecheck` | TypeScript in strict mode. |
| `corepack yarn test` | The test suite. |
| `corepack yarn build` | The production build. |
| `corepack yarn validate` | The complete gate: lint, typecheck, test and build. Run it before every pull request. |

## What is checked, and when

**On every commit** (Git hooks, installed by `corepack yarn install`):

- The commit message follows [Conventional Commits](https://www.conventionalcommits.org/),
  for example `feat(orders): add refund endpoint`.
- ESLint, with fixes, on staged JavaScript and TypeScript files.
- Secret scanning on every staged file.

**In `corepack yarn lint`**, and therefore in `validate` and in CI:

| Script | Checks |
| --- | --- |
| `lint:foundation` | The project record is complete and matches `package.json`; every exception is complete, refers to a known requirement and has not expired. |
| `lint:code` | ESLint: typed TypeScript rules, arrow functions, named constants instead of inline numbers, tracked debt markers, described suppressions, bounded complexity, SonarJS bug and code-smell rules, React and accessibility rules. |
| `lint:deps` | Production code does not import development dependencies; every imported package is declared; client, server and shared packages keep their boundaries. |
| `lint:secrets` | No secret in any file Git can commit. |

`git commit --no-verify` skips the hooks but not `lint`, so a skipped check
still fails `validate` and CI.

## When a check fails

| Message or rule | What to do |
| --- | --- |
| `foundation/todo-issue-reference` | Open or find the issue and write `TODO(#123): …`. If the work is done in this change, remove the marker instead. |
| `sonarjs/no-commented-code` | Delete the commented-out code. Git keeps the history. |
| `@eslint-community/eslint-comments/require-description`, `no-unlimited-disable` | Name the rule and give the reason: `// eslint-disable-next-line rule-name -- why this site is safe`. Prefer fixing the code. |
| `sonarjs/cognitive-complexity`, `max-depth` | Split the function into named steps or return early to flatten nesting. Suppress only when the complexity mirrors an external specification, and name it. |
| Other `sonarjs/*` rules | Fix the reported pattern. A *security hotspot* rule, such as `no-os-command-from-path`, marks code to review: if the reviewed code is correct, keep it and suppress that single line with the reason. |
| `@typescript-eslint/no-magic-numbers` | Move the value to a `UPPER_SNAKE_CASE` export of the feature's `<feature>.constants.ts`. |
| `func-style`, `prefer-arrow-callback` | Write the function as `const name = (…) => …`. |
| `lint:secrets` finding | Remove the value and **rotate the secret**: once committed or pushed, it is compromised. Keep real values in an ignored `.env`. |
| `not-to-dev-dep` | Move the package to `dependencies` if production needs it, or keep the import in tests and tooling only. |
| `no-non-package-json` | Declare the package in the `package.json` of the code that imports it. |
| `no-client-to-server`, `no-server-to-client`, `no-package-to-app` | Move the shared code into `packages/shared` and import it from there. |
| `lint:foundation`: exception expired | Review the deviation. Fix it and delete the entry, or renew it with a new `expires` date. |
| `lint:foundation`: record mismatch | Update `.engineering-foundation.yml` to describe the project as it is now. |
| `lint:foundation` warning about R1 | The project added authentication or payments. Reassess the security level and update the record; the warning never blocks. |

## Recording an exception

A deliberate deviation from a MUST requirement goes in `docs/exceptions.yml`:

```yaml
exceptions:
  - id: CORE-COMPLEXITY-001
    scope: src/protocol/state-table.ts
    justification: The state table mirrors the transitions of RFC 9110.
    compensatingControl: Table-driven tests cover every transition.
    owner: platform team
    expires: 2027-03-31
```

- `id` must be an existing requirement identifier, listed in
  `.config/foundation/requirements.json`.
- `compensatingControl` is optional; every other field is required.
- After `expires`, `lint` fails until the entry is renewed or removed. Choose a
  date when the deviation should realistically be reviewed.
- A lint suppression in the code still needs its own reason; the register
  records the decision, the suppression marks the site.

## Workflow modes

The project record states how changes are reviewed:

- **`assisted`**: a person reviews every pull request. This is the default.
- **`autonomous`**: review is automated.

The mode is recorded and validated today. Later foundation releases will use
it to adjust thresholds and the automated review loop; until then it documents
the decision for reviewers and agents. Change it in
`.engineering-foundation.yml` when the way the project is reviewed changes.

## Updating a project to a new foundation version

Copied assets do not update themselves. Until the planned synchronization
command is available, compare `foundationVersion` in your record with the
foundation's release notes and ADRs, copy the changed assets, update
`requirements.json` and run `corepack yarn validate`. A major version can make
code that passed before fail; the ADR of each change describes the migration.

## Further reading

- [Governance](governance.md): how requirements are written, sourced and
  changed.
- [Architecture decision records](adr/): why each tool and rule was chosen.
- [Shared foundation](../skills/bootstrap-web-project/references/foundation.md)
  and [tooling](../skills/bootstrap-web-project/references/tooling.md): the
  normative detail behind this manual.
