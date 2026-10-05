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
- [Before a pull request](#before-a-pull-request)
- [When a check fails](#when-a-check-fails)
- [Planning a feature](#planning-a-feature)
- [Recording an exception](#recording-an-exception)
- [Workflow modes](#workflow-modes)
- [Using the Claude Code plugin](#using-the-claude-code-plugin)
- [Retrofitting an existing project](#retrofitting-an-existing-project)
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

**With Claude Code, install the plugin.** It contains the bootstrap skill, the
pre-pull-request reviewer, the exception and retrofit skills and two hooks
([Using the Claude Code plugin](#using-the-claude-code-plugin)):

```text
/plugin marketplace add <path or Git URL of this repository>
/plugin install sef@software-engineering-foundation
```

**Without the plugin**, the `bootstrap-web-project` skill is a self-contained
directory. Make it available to your agent:

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
| `.engineering-foundation.yml` | The project record: foundation version, profiles, security level and rationale, CI, workflow mode, and the `premerge` base branch and coverage minimum. |
| `docs/exceptions.yml` | The register of exceptions to foundation requirements, empty at first. |
| `docs/foundation/` | The foundation requirements, with `README.md` listing the ones that apply to this project. Read-only: synchronization replaces it. |
| `docs/features/` | Feature plans and specifications, and their templates in `_template/`. |
| `.config/eslint/` | The shared ESLint modules, composed by `eslint.config.mjs`. |
| `.config/typescript/` | The shared strict TypeScript configurations. |
| `.config/foundation/` | The record, exception and plan checker (`check-foundation.mjs`), the pre-merge script (`premerge.mjs`), the known requirement identifiers (`requirements.json`) and the hash of every foundation-owned file (`assets.json`). |
| `.dependency-cruiser.mjs` | Dependency class and boundary rules. Project rules and options go in `.dependency-cruiser.local.mjs`. |
| `knip.config.js` | Unused file, export and dependency detection, run by `premerge`. Project options go in `knip.local.js`. |
| `.secretlintrc.json` | Secret scanning rules. |
| `.husky/`, `commitlint.config.mjs`, `lint-staged.config.mjs` | Git hooks: commit message and staged-file checks. |
| `.github/pull_request_template.md`, `.gitlab/merge_request_templates/Default.md` | Pull and merge request templates with the pre-merge checklist; keep the one for your platform. |
| `.gitlab-ci.yml` | Only with `--ci gitlab`: the gate jobs and GitLab Secret Detection. |

Files under `.config/` and `docs/foundation/`, the feature templates and the
dotfiles above are copied from the foundation. Prefer extending them through the options they export, such as
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
| `corepack yarn validate` | The complete gate: lint, typecheck, test and build. |
| `corepack yarn premerge` | Before opening a pull request: the gate plus the checks on what the branch changes. See [Before a pull request](#before-a-pull-request). |

## What is checked, and when

**On every commit** (Git hooks, installed by `corepack yarn install`):

- The commit message follows [Conventional Commits](https://www.conventionalcommits.org/),
  for example `feat(orders): add refund endpoint`.
- ESLint, with fixes, on staged JavaScript and TypeScript files.
- Secret scanning on every staged file.

**In `corepack yarn lint`**, and therefore in `validate` and in CI:

| Script | Checks |
| --- | --- |
| `lint:foundation` | The project record is complete and matches `package.json`; every exception is complete, refers to a known requirement and has not expired; every feature plan has its front matter and sections, no open blocking question once `ready`, and no unsettled acceptance criterion once `done`. |
| `lint:code` | ESLint: typed TypeScript rules, arrow functions, named constants instead of inline numbers, tracked debt markers, described suppressions, bounded complexity, SonarJS bug and code-smell rules, React and accessibility rules. |
| `lint:deps` | Production code does not import development dependencies; every imported package is declared; client, server and shared packages keep their boundaries. |
| `lint:secrets` | No secret in any file Git can commit. |

**When a Fastify application starts**, including in every test that builds
it: each route must declare a response schema, a `params` schema when its path
has parameters, and a `body` schema when it accepts a body. A route that does
not is refused at registration, so the application does not start.

`git commit --no-verify` skips the hooks but not `lint`, so a skipped check
still fails `validate` and CI.

## Before a pull request

Run `corepack yarn premerge` on a committed branch. It runs lint, typecheck,
build and Knip, which rejects unused files, exports and dependencies, then the
tests with coverage, and checks that the lines your branch changes are
exercised by tests:

```text
diff coverage: 92.3% of 13 changed statement lines against origin/main (minimum 80%)
premerge: passed on 4c52ce0a…
```

- Paste the commit from the last line in the pull request checklist. Commit
  first: with uncommitted changes premerge warns that the result does not
  describe that commit.
- The branch is compared with `origin/main`. Fetch it first, or set another
  target for one run with `FOUNDATION_BASE_REF=origin/develop corepack yarn premerge`,
  or permanently in `premerge.baseRef` in `.engineering-foundation.yml`.
- The minimum is `premerge.diffCoverage` in the same file, 80 by default.
  Lines without a statement, tests and entry points such as `src/server.ts`
  are not counted.
- In a retrofitted project, premerge also fails when a baseline of frozen
  violations has more entries than on the base branch; see
  [Retrofitting an existing project](#retrofitting-an-existing-project).

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
| Fastify: `must declare a response schema`, `a params schema` or `a body schema` | Add the zod schema to the route's `schema` option. For a streaming or proxy route that cannot have a body schema, set `config: { contractException: 'why, and how the payload is bounded' }`. |
| Knip: unused file, export or dependency | Delete what nothing uses. For an export that is deliberate public API, add `/** @public */` above it. For a package used in a way Knip cannot see, add it to `ignoreDependencies` in `knip.config.js` with a comment saying how it is used. |
| `premerge`: diff coverage below the minimum | Add tests for the listed `file:lines`, or remove the code if nothing needs it. |
| `premerge`: baseline grew | Fix the new violations; never re-run `--suppress-all` to hide them. |
| ESLint: suppressions left that do not occur anymore | Good news: run `corepack yarn eslint . --prune-suppressions` and commit the smaller baseline. |
| `premerge`: no coverage report | Install `@vitest/coverage-v8` at the vitest version of each workspace and add a `coverage` block with `include` to its vitest configuration. |
| `premerge` warning: changed source outside the coverage scope | Intended for entry points; otherwise widen `coverage.include`. With `allowExternal`, start every pattern with `**/`. |
| `lint:secrets` on a documentation example | Put `secretlint-disable-next-line` in a comment on the line before it, such as `<!-- secretlint-disable-next-line -->` in Markdown. |
| `premerge`: base not found | `git fetch origin`, or set `FOUNDATION_BASE_REF` to the branch you will merge into. |
| `lint:foundation`: plan without front matter, with an unknown status or missing a section | Start from `docs/features/_template/plan.md` and keep every heading, even when a section only says "none". |
| `lint:foundation`: plan with open blocking questions | Answer them, record the answers under "Decisions", empty the list, then move the status forward. |
| `lint:foundation`: plan done with an unsettled criterion | Check it if verified, or mark it `manual: <who>` or `deferred: #<issue>`. |
| `lint:foundation`: exception expired | Review the deviation. Fix it and delete the entry, or renew it with a new `expires` date. |
| `lint:foundation`: record mismatch | Update `.engineering-foundation.yml` to describe the project as it is now. |
| `lint:foundation`: `premerge.baseRef` or `premerge.diffCoverage` invalid | Set the branch you merge into and a percentage between 0 and 100. |
| `lint:foundation` warning about R1 | The project added authentication or payments. Reassess the security level and update the record; the warning never blocks. |

## Planning a feature

For work that needs analysis, write the plan before the code: copy
`docs/features/_template/plan.md` to `docs/features/<slug>/plan.md`, and
`spec.md` next to it for user interface work.

The front matter carries the issue, the `status`, the security reassessment
and, optionally, a `workflow` that overrides the project's mode for this
feature:

| Status | Meaning | What `lint` requires |
| --- | --- | --- |
| `draft` | Under analysis. | Front matter and every section present. |
| `ready` | Analysis complete. | No item left under "Blocking questions". |
| `in-progress` | Being implemented. | Same as `ready`. |
| `done` | Merged. | Every "Acceptance" item checked (`- [x]`), or marked `manual: <who>`, or `deferred: #<issue>`. |

While implementing, record every divergence from the plan under "Changes
during implementation": it is the first thing a reviewer reads.

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

`/sef:review` follows it: one review pass reported to you in `assisted` mode,
up to three fix-and-review rounds in `autonomous` mode (see
[Using the Claude Code plugin](#using-the-claude-code-plugin)). A feature plan
can override it with `workflow` in its front matter. Change the project's mode
in `.engineering-foundation.yml` when the way the project is reviewed changes.

## Using the Claude Code plugin

The `sef` plugin adds:

| Component | Use |
| --- | --- |
| `/sef:bootstrap-web-project` | Create a project, as described above. |
| `/sef:review` | Review the current branch before a pull request. |
| `/sef:record-exception` | Prepare an entry in `docs/exceptions.yml` for a deliberate deviation. |
| `/sef:retrofit-project` | Bring an existing project onto the foundation in waves; see [Retrofitting an existing project](#retrofitting-an-existing-project). |
| `sef:foundation-reviewer` agent | Started by `/sef:review`; reviews the diff against the plan and the requirements. |
| Hook before every shell command | Blocks `git commit --no-verify`, `git commit -n`, `HUSKY=0 git …` and `--no-verify` on push, merge and rebase. |
| Hook when the agent stops | Runs `corepack yarn validate` if the code changed since it last passed, and sends failures back to the agent. |

**`/sef:review`** runs the reviewer in a fresh context, so it judges the code
rather than the intentions of whoever wrote it. The reviewer runs the gate,
checks the diff against the plan's acceptance criteria and scope, checks the
security reassessment and the requirements lint cannot verify, and fixes only
trivial problems in a separate `fix(review): …` commit. Its report lists
*Must fix*, *Should fix*, *To decide* and *Passed* items, each with a location
and a requirement or plan section. Then:

- in **assisted** mode you read the report and decide;
- in **autonomous** mode the agent fixes the *Must fix* items and reviews
  again, at most three rounds, then hands what remains to you. *To decide*
  items always come to you.

When the review is clean it runs `premerge` and drafts the pull request
description.

**The stop hook** runs only in foundation projects, at most once per state of
the code. After two blocks on the same unchanged failure it lets the agent
stop, so a failure the agent cannot fix comes back to you instead of looping.
Set `SEF_STOP_GATE=off` to disable it for a session, or
`SEF_STOP_GATE_COMMAND="corepack yarn lint"` to run a faster check.

## Retrofitting an existing project

An existing project adopts the foundation in waves of small pull requests,
never in one change. Start with a read-only inventory:

```sh
node <foundation>/skills/retrofit-project/scripts/inventory-project.mjs --target <dir>
```

It reports the stack, package manager, ESLint configuration, hooks, CI,
TypeScript flags, suppressions, debt markers and suspicious tracked files, each
mapped to a requirement. With the plugin, `/sef:retrofit-project` runs the
whole process: risk classification, gap assessment in
`docs/retrofit-assessment.md`, and one plan per pull request:

1. **Wave 0**: Yarn Modern, a one-off scan of the Git history for secrets, the
   foundation files through `sync-foundation.mjs`, and the scripts and hooks.
2. **Wave 1**: the remaining checks, with existing violations frozen in
   baselines (`eslint-suppressions.json`, dependency-cruiser known violations).
3. **Wave 2**: mechanical fixes in separate commits.
4. **Wave 3**: the security controls the classified level requires.
5. **Wave 4**: burning the baselines down.

`premerge` fails when a baseline has more entries than at the merge base: fix
a new violation instead of suppressing it. ESLint itself fails when a
suppression no longer matches anything; run
`corepack yarn eslint . --prune-suppressions` to shrink the baseline.

The [waves reference](../skills/retrofit-project/references/waves.md) has the
exact steps and a worked example for a project with `frontend/`, `server/`
and a `shared/` folder reached through path aliases: the manifest, the
scripts, adding the foundation's ESLint rules to an existing configuration,
running dependency-cruiser per workspace, Knip and coverage settings. Adapt
the foundation's dependency-cruiser and Knip configurations through
`.dependency-cruiser.local.mjs` and `knip.local.js`, never by editing the
foundation's files.

## Updating a project to a new foundation version

The files the foundation owns (everything under `.config/`, the hooks, the
dependency, Knip and secret rules, the request templates and the pipeline) are
listed with their hash in `.config/foundation/assets.json`. To bring a project
to the foundation version you have checked out:

```sh
node <foundation>/skills/bootstrap-web-project/scripts/sync-foundation.mjs --target .
node <foundation>/skills/bootstrap-web-project/scripts/sync-foundation.mjs --target . --apply
```

The first command only reports; the second writes. Each file gets one status:

| Status | Meaning | What `--apply` does |
| --- | --- | --- |
| `current` | Already the foundation's version. | Nothing. |
| `update` | Unchanged since the foundation wrote it, now outdated. | Replaces it. |
| `add` | New in this foundation version. | Writes it. |
| `conflict` | Changed in your project. | Leaves it and writes `<file>.sef-new` next to it. Merge the two by hand, delete the `.sef-new` file and run again. |
| `missing` | Deleted in your project. | Nothing. To restore it, remove its entry from `assets.json` and run again: it becomes `add`. If you removed it on purpose, record why in `docs/exceptions.yml`; the version stays unaligned until the file is back. |
| `obsolete` | No longer part of the foundation. | Nothing; delete it yourself if nothing uses it. |

Lines starting with `manual` list the tools and scripts the foundation's checks
need; add them to the root `package.json` and run `corepack yarn install`.
Lines starting with `stack` are the versions of your stack the foundation was
verified with; they never block, and upgrading to them is optional. The record's
`foundationVersion` moves to the new version only when no conflict, missing
file or manual change remains. Finish with `corepack yarn validate`. A major
version can make code that passed before fail; its ADR describes the
migration.

## Further reading

- [Governance](governance.md): how requirements are written, sourced and
  changed.
- [Architecture decision records](adr/): why each tool and rule was chosen.
- [Shared foundation](../skills/bootstrap-web-project/references/foundation.md)
  and [tooling](../skills/bootstrap-web-project/references/tooling.md): the
  normative detail behind this manual.
