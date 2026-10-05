# Software Engineering Foundation

Shared, model-agnostic foundations for starting and maintaining TypeScript web
projects, usable by any team and any coding agent.

This repository combines:

- normative engineering standards;
- stack-specific guidance;
- reusable project assets;
- the `bootstrap-web-project` Agent Skill.

The repository is the source of truth. The skill is the primary executable
entrypoint for agents, while every document remains usable by humans and agents
without native Agent Skills support.

## Status

The repository structure, shared standards, mandatory accessibility standard,
risk-based security standard, shared tooling assets, the React with Vite,
Fastify, Nest, Supabase and full-stack monorepo profiles and the optional
GitLab CI baseline are established. Every template is verified on each test run
by generating a project and running its lint, typecheck, tests and build. The
lint gate also checks secrets, tracked debt, described suppressions, bounded
complexity, dependency classes, workspace boundaries, the project record and
the exception register. The
first stable release follows the end-to-end validation of generated projects.

## Supported scope

- TypeScript
- React single-page applications built with Vite
- Fastify backends
- Nest backends
- Supabase and PostgreSQL
- Single-package repositories and full-stack monorepos
- Optional basic GitLab CI

Next.js is intentionally outside the initial scope.

## Fixed decisions

- Yarn is the only package manager.
- New projects use a pinned Yarn Modern release through Corepack and the
  `node-modules` linker.
- ESLint is the only JavaScript and TypeScript linting and formatting engine.
- Prettier is not used.
- Functions are arrow functions unless an arrow cannot express the code.
- Meaningful numeric literals live in colocated `<feature>.constants.ts`
  modules, not inline.
- WCAG 2.2 AA is mandatory for every frontend.
- Security controls are graduated through the R1, R2 and R3 risk levels.
- R2 is the default for authenticated applications.
- CI templates are optional.
- Secrets, credentials and authentication keys must never be printed.
- Secrets are scanned in every staged file and in every committable file by
  `lint`.
- Every `TODO` or `FIXME` references its issue, as in `TODO(#123)`, and
  commented-out code is removed.
- Every lint suppression names its rules and states a reason.
- Cognitive complexity is bounded at 15 per function and nesting at four
  levels.
- Production code never imports development dependencies, and client, server
  and shared packages keep their boundaries; `lint` checks both.
- Every project records its workflow mode, `assisted` or `autonomous`, and its
  exceptions in an expiring register checked by `lint`.

## Entry points

- People creating or maintaining a project start at the
  [user manual](docs/manual.md).
- Agents bootstrapping a project start at
  [`skills/bootstrap-web-project/SKILL.md`](skills/bootstrap-web-project/SKILL.md).
- Contributors changing a standard start at
  [`docs/governance.md`](docs/governance.md).
- Provenance and public sources are recorded in
  [`docs/source-register.md`](docs/source-register.md).

## Repository layout

```text
docs/                         Governance, provenance and decisions
skills/bootstrap-web-project Agent workflow, references, generated assets and scripts
tests/                        Structural and behavioral validation
```

The skill uses progressive disclosure: it reads the shared foundation first,
then only the risk and stack references relevant to the selected project.

## License

Released under the [MIT License](LICENSE).
