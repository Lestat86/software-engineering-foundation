# Repository instructions

## Purpose

This repository defines shared TypeScript web engineering standards and the
`bootstrap-web-project` skill. It is not a product application or a collection
of generic tutorials.

## Working rules

- Read `docs/governance.md` before changing normative requirements.
- Keep `skills/bootstrap-web-project/SKILL.md` short and focused on routing.
- Put conditional detail in the relevant reference file.
- Put files intended for generated projects under `assets/`, not in references.
- Put deterministic bootstrap steps in `skills/bootstrap-web-project/scripts/`
  and keep the references as their specification. Scripts never delete or
  overwrite user files.
- Do not duplicate a requirement across multiple documents; link to its
  canonical location.
- Use Yarn through Corepack. Do not introduce npm, pnpm or Bun workflows.
- Use ESLint for JavaScript and TypeScript formatting. Do not add Prettier.
- Write arrow functions and colocated `*.constants` modules in this
  repository too: the foundation passes the gate it ships.
- Treat WCAG 2.2 AA as mandatory for every React profile.
- Never print, commit, log or place secrets in fixtures.
- Update `docs/manual.md` in the same change as any behavior a project user
  sees: a new check, script, option, generated file or failure message.

## Verification

Run the repository checks with:

```sh
corepack yarn test
```

When production assets are added, verify them through representative fixtures
rather than tests that only compare documentation wording.

## Change discipline

New MUST requirements need a rationale, scope, verification method and source.
Material changes to scope, tooling or architecture require an ADR. Preserve
traceability to versioned external standards such as WCAG and OWASP ASVS.
