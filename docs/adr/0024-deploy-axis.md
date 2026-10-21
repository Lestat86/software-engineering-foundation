# ADR 0024: a deployment axis for deployment rules

- **Status:** proposed
- **Date:** 2026-10-21

## Context

The foundation assumes a single long-lived process: `FASTIFY-SECURITY-001`
keeps the rate limit in memory, the templates run background jobs in the
server, and nothing says when work may happen after a response. On a
serverless platform instances come and go, the CPU may stop after the
response and several instances serve at once, so those assumptions break
silently. The pilot project hit this while moving from a VPS to Cloud Run:
its in-memory rate limits divided by the instance count, its detached email
sends could be cut off, and a stopped scheduled job would have raised no
error.

ADR 0009 excludes deployment from the CI baseline, because deployment
strategies differ per project. Profiles describe stacks, and overlays such as
`supabase` add files to a base profile.

## Decision

- Add a deployment axis, `--deploy <target>`, modeled on `--ci`: the
  generator accepts `none` (the default) and `cloud-run`, records
  `deploy: "<target>"` in `.engineering-foundation.yml`, and
  `check-foundation.mjs` rejects any other value. A record without `deploy`
  means `none`, so existing projects keep passing.
- The axis carries deployment rules, not deployment pipelines or
  infrastructure as code. A target other than `none` makes
  `references/deploy/serverless.md`, the rules of any serverless platform,
  applicable; each target adds its own reference, `references/deploy/cloud-run.md`
  for the first one. `sync-foundation.mjs` reads the field, so a synchronized
  project lists the same references as a generated one.
- The first version ships no assets: the Dockerfile, the infrastructure
  definition and the outbox code stay the project's, and the choice is
  revisited after the pilot.
- It is an axis rather than an overlay profile. An overlay cannot replace a
  file of its base profile, which the generator reports as a
  `profile conflict`, and in a monorepo overlays apply at the root, while the
  rules concern the server workspace.
- `FASTIFY-SECURITY-001` keeps its ID and level and states that, with a
  deploy target, its in-memory limit is only a per-instance brake.

This revises the scope of ADR 0009 without contradicting it: the CI baseline
still contains no deployment, and the deployment axis adds rules a project
follows wherever and however it deploys.

## Consequences

- A project that deploys to Cloud Run reviews against thirteen more
  requirements, most checked by review and tests rather than by tooling.
- A new target is a new value in the generator and in `check-foundation.mjs`
  plus its reference; the serverless rules apply to it unchanged.
- Projects that add `deploy` later run `sync-foundation.mjs`, which adds the
  references and rewrites the index.
