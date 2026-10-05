# Project instructions

This project follows Software Engineering Foundation version
`{{FOUNDATION_VERSION}}` with profiles `{{PROFILES}}` and security level
`{{SECURITY_LEVEL}}`.

## Commands

Use Yarn through Corepack:

```sh
corepack yarn lint
corepack yarn typecheck
corepack yarn test
corepack yarn build
corepack yarn validate
```

## Invariants

- Use TypeScript strict mode.
- Use ESLint for linting and JavaScript or TypeScript formatting.
- Do not add Prettier or another package manager.
- Define functions as arrow functions; `function` is only for generators,
  for code needing its own `this`, `arguments` or `new.target`, and for
  required hoisting.
- Declare meaningful numeric literals as `UPPER_SNAKE_CASE` exports of a
  `<feature>.constants.ts` module colocated with the feature.
- Delete dead code instead of commenting it out; every `TODO` or `FIXME`
  references its issue, as in `TODO(#123)`.
- Give every ESLint disable directive the rules it disables and a reason after
  `--`, on the narrowest scope; split complex functions instead of
  suppressing the complexity check.
- Never commit, print or log secrets and authentication material.
- Validate external input at the appropriate trust boundary.
- Preserve or improve tests for changed behavior.
{{ACCESSIBILITY_INVARIANTS}}

Read `.engineering-foundation.yml` for the selected profiles and security
classification. Apply the matching security profile and keep ASVS evidence
versioned with the project. Document any intentional deviation from a MUST
requirement with its identifier, reason, compensating control, owner and review
date.
