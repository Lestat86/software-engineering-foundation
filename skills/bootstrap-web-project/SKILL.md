---
name: bootstrap-web-project
description: Bootstrap a new TypeScript web project using the shared React, Fastify, Nest, Supabase, accessibility, security, testing, ESLint and optional GitLab CI foundations. Use for new projects or empty repositories; do not use for Next.js projects or broad retrofits of existing applications.
---

# Bootstrap Web Project

Create a working project from the selected profiles while preserving explicit
user choices and recording every applied foundation decision.

## Non-negotiable constraints

- Use Yarn. For a new project, pin Yarn Modern and invoke it through Corepack.
- Use ESLint as the only JavaScript and TypeScript linting and formatting
  engine. Do not add Prettier.
- Apply WCAG 2.2 AA requirements to every React frontend.
- Classify security risk before generating application code. Use R2 for an
  authenticated application unless the project is explicitly classified
  otherwise.
- Never print, commit or place real secrets in generated files or command
  output.
- GitLab CI is optional and must be selected explicitly.
- Next.js is outside scope. Stop and explain the boundary if it is requested.

## Workflow

1. Inspect the target and do not overwrite meaningful existing files without
   explicit authorization.
2. Determine whether the project is frontend, backend or full-stack; identify
   the selected supported frameworks, whether GitLab CI is wanted and the
   workflow mode: `assisted` when people review every pull request, or
   `autonomous` when review is automated. Default to `assisted`.
3. Read [the shared foundation](references/foundation.md).
4. Read [the shared tooling implementation](references/tooling.md).
5. Read [risk classification](references/security/risk-classification.md) and
   the selected risk-level reference.
6. Read only the applicable stack references listed below.
7. Generate the project with the skill script, which applies the profiles in
   order, writes `AGENTS.md`, `.engineering-foundation.yml` and an empty
   `docs/exceptions.yml`, and refuses a target that is not empty:

   ```sh
   node <skill-directory>/scripts/generate-project.mjs \
     --target <dir> --name <package-name> \
     --profile <base-profile> [--profile supabase] \
     [--client react-vite --server fastify|nest] [--ci gitlab] \
     --security-level R1|R2|R3 --security-rationale "<why>" [--html-lang <tag>] \
     [--workflow assisted|autonomous]
   ```

   Full-stack projects use `--profile monorepo` with `--client` and
   `--server`. Only if the script cannot run, apply the file steps in each
   reference by hand; they are the specification the script implements.
8. Run `node <skill-directory>/scripts/ensure-git-root.mjs <target>` so the
   target is its own Git root before any dependency installation. A containing
   repository does not satisfy this requirement.
9. Install dependencies and run all generated verification commands.
10. Report the created profiles, security level, checks run and any documented
   exception.

## Reference routing

- For every project, read [foundation](references/foundation.md).
- For every project, read [tooling](references/tooling.md).
- For R1, read [R1 — Basic](references/security/r1-basic.md).
- For R2, read [R2 — Standard](references/security/r2-standard.md).
- For R3, read [R3 — High](references/security/r3-high.md).
- For every frontend, read [accessibility](references/accessibility.md).
- For a full-stack project, read [monorepo](references/monorepo.md).
- For React with Vite, read [React](references/stacks/react.md).
- For Fastify, read [Fastify](references/stacks/fastify.md).
- For Nest, read [Nest](references/stacks/nest.md).
- For Supabase or PostgreSQL, read [Supabase](references/stacks/supabase.md).
- If GitLab CI is selected, read [GitLab CI](references/gitlab-ci.md).

## Completion criteria

Finish only when the generated project installs reproducibly, Git reports the
target itself as the repository root, Husky's local `core.hooksPath` is
`.husky/_`, and its lint, typecheck, test and build commands pass. If a required
check cannot run, report the exact blocker instead of weakening or removing the
check.
