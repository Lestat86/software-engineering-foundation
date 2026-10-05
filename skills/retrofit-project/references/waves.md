# Retrofit waves

Each wave is one or more small pull requests with their own plan. The order
matters: every wave relies on the checks installed by the previous one.

## Wave 0 — safety net, no application code changes

1. **Package manager.** Move to Yarn Modern through Corepack, first and alone
   in its pull request, because the foundation's scripts and hooks assume it:
   - add `packageManager: "yarn@<version from versions.json>"` and a
     `.yarnrc.yml` with `nodeLinker: node-modules` (native projects such as
     Capacitor resolve packages from `node_modules`);
   - regenerate the lockfile and verify typecheck, tests, every build target and
     container images: resolved versions can change;
   - replace `yarn workspaces run <script>` with
     `yarn workspaces foreach -A run <script>`;
   - move `"prepare": "husky"` to `postinstall`, because Yarn Modern does not
     run `prepare` and the hooks would silently stop installing;
   - replace `npx` in hooks and scripts with `yarn`;
   - in Dockerfiles, `corepack enable` and `yarn install --immutable`, and
     `yarn workspaces focus --production` for production-only images;
   - merge it quickly: it conflicts with every open branch that touches
     `package.json` or the lockfile.
2. **History scan.** Scan the whole Git history once for secrets with a tool
   that reads history, for example `gitleaks git`, run without adding it as a
   dependency. Rotate every real secret found; deleting it is not enough.
3. **Adopt the foundation files.** Write `.engineering-foundation.yml` from the
   bootstrap skill's template with the classified level, the profiles closest
   to the project and the workflow mode, then run
   `sync-foundation.mjs --target <dir>` and, after review, with `--apply`. It
   adds the foundation-owned files (checks, hooks, rules, templates,
   requirements) and writes `<file>.sef-new` beside the project's own versions.
   Merge each `.sef-new` deliberately: keep the project's own ESLint
   composition and add the foundation modules to it.
4. **Scripts and hooks.** Add `lint:foundation`, `lint:code`, `lint:deps`,
   `lint:secrets`, `validate` and `premerge`; make the pre-commit hook run only
   `lint-staged`, moving repository-wide checks to `validate`
   (`GIT-HOOK-001`); add the commit-msg hook if missing.

From here the reviewer and the pre-merge gate work on every later pull request.

## Wave 1 — tools with baselines

Turn on the remaining checks, freezing what already violates them:

| Check | Baseline |
| --- | --- |
| ESLint rules of the foundation | `eslint . --suppress-all` writes `eslint-suppressions.json`. New violations fail; fixed ones must be pruned with `--prune-suppressions`, because ESLint fails on stale suppressions. |
| dependency-cruiser | `depcruise-baseline` writes `.dependency-cruiser-known-violations.json`; run `lint:deps` with `--ignore-known`. |
| Stricter TypeScript flags | Enable one workspace at a time, starting with shared code, or keep the flag off with an exception until the wave that fixes it. |
| Knip | Start with targeted `ignore` entries and remove them as the code is cleaned. |

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
