# Core engineering standard

These requirements apply to production code, tests, scripts and configuration
unless a narrower scope is stated. Framework references may add constraints but
must not weaken this baseline.

## `CORE-CONTRACT-001` — explicit contracts at boundaries

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Define explicit inputs, outputs and failure behavior at
  module, service and external-system boundaries. Validate untrusted data when
  it crosses into a trusted part of the application.
- **Rationale:** Boundary contracts localize uncertainty and prevent invalid
  data from spreading through otherwise typed code.
- **Verification:** Review public interfaces and trace each external input to a
  schema or equivalent runtime validation before business logic uses it.
- **Sources:** [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html), practitioner experience with production TypeScript applications.
- **Exceptions:** Trusted compile-time-only inputs may omit runtime validation;
  document why the trust boundary is guaranteed.

## `CORE-ERROR-001` — intentional error handling

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Handle failures at the layer that can recover, translate or
  add useful context. Do not silently swallow errors, expose internal failure
  details to untrusted clients or use a successful result to represent failure.
- **Rationale:** Consistent failure semantics make defects diagnosable and keep
  implementation details out of public interfaces.
- **Verification:** Exercise expected failure paths in tests and review empty
  catches, discarded promises and responses whose status contradicts failure.
- **Sources:** [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html), practitioner experience with production TypeScript applications.
- **Exceptions:** A deliberately ignored failure must have a narrow comment
  explaining why it is safe and, when relevant, an observable fallback.

## `CORE-LOG-001` — useful and safe telemetry

- **Level:** MUST
- **Applies to:** applications and operational scripts
- **Risk levels:** R1, R2, R3
- **Requirement:** Record failures and material state transitions with enough
  structured context to investigate them. Never log secrets, credentials,
  authentication tokens, complete environment dumps or unnecessary personal
  data.
- **Rationale:** Telemetry must support operations without creating a second
  source of sensitive-data exposure.
- **Verification:** Review logging calls and CI output; scan representative logs
  for prohibited values and confirm errors retain safe diagnostic context.
- **Sources:** [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html), lesson from a production incident where a pipeline printed authentication material.
- **Exceptions:** None for credentials or authentication material. Approved
  sensitive-data logging requires a documented purpose, minimization, access
  control and retention policy.

## `CORE-CONFIG-001` — environment-independent configuration

- **Level:** MUST
- **Applies to:** all deployable projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep environment-specific configuration outside source code.
  Commit `.env.example` or equivalent documentation containing names and safe
  placeholders only; fail clearly when required configuration is absent.
- **Rationale:** The same revision should be promotable across environments
  without embedding credentials or deployment-specific values.
- **Verification:** Search tracked files for real environment values, start the
  application with missing required configuration and inspect the resulting
  diagnostic.
- **Sources:** [The Twelve-Factor App — Config](https://12factor.net/config), [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html).
- **Exceptions:** Non-sensitive defaults that are genuinely identical in every
  environment may remain in source.

## `CORE-CLARITY-001` — optimize code for comprehension

- **Level:** SHOULD
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Prefer small cohesive units, intention-revealing names and
  direct control flow. Comments explain constraints and reasons that code
  cannot express; they do not narrate obvious implementation steps.
- **Rationale:** Readability reduces review cost and makes safe modification by
  humans and agents more reliable.
- **Verification:** Review changed code for mixed responsibilities, ambiguous
  names, avoidable nesting and comments that duplicate behavior.
- **Sources:** Practitioner experience with production TypeScript applications.
- **Exceptions:** Generated code follows the generator's conventions and is not
  manually restyled.

## `CORE-CONSTANT-001` — named constants instead of inline literals

- **Level:** MUST
- **Applies to:** application and script source in all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Declare every numeric literal that carries domain, protocol
  or operational meaning as an `UPPER_SNAKE_CASE` constant exported from a
  `<feature>.constants.ts` module colocated with the feature that owns it. A
  value shared by several features lives in the constants module of the module
  that owns the concept and is imported, never copied. `-1`, `0`, `1` and array
  indices stay inline because they carry no meaning to name. Test files and
  tool configuration are exempt: an assertion and a configuration entry already
  state their value at its only site.
- **Rationale:** A literal repeated across call sites hides both its meaning
  and its other occurrences, so a change silently misses one of them. A single
  named declaration per concept makes the value searchable and changeable in
  one place, and names the invariant at every use.
- **Verification:** `no-magic-numbers` and `@typescript-eslint/no-magic-numbers`
  in the shared ESLint configuration reject inline literals;
  `@typescript-eslint/naming-convention` rejects a constants module export that
  is not `UPPER_SNAKE_CASE`. Review that each constants module stays colocated
  with the feature it serves and holds no logic.
- **Sources:** [ESLint `no-magic-numbers`](https://eslint.org/docs/latest/rules/no-magic-numbers), [typescript-eslint `no-magic-numbers`](https://typescript-eslint.io/rules/no-magic-numbers/), [typescript-eslint `naming-convention`](https://typescript-eslint.io/rules/naming-convention/), practitioner experience with production TypeScript applications.
- **Exceptions:** A literal fixed by an external specification, appearing once
  at the boundary that implements it, may stay inline when a name would only
  restate the surrounding code; record the reason in a narrow comment. A
  generated file follows its generator's conventions.

## `CORE-ARROW-001` — arrow functions are the default callable form

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Define functions as arrow functions bound to a `const`. Use
  the `function` keyword only where an arrow cannot express the code: a
  generator, a function that needs its own `this`, `arguments` or `new.target`,
  and a declaration whose hoisting is required. Record which case applies in a
  narrow comment at the site. Class and object methods keep their own syntax
  and are outside this requirement.
- **Rationale:** One callable form removes a choice that has no criterion and
  makes every definition recognizable at a glance by humans and agents. An
  arrow closes over the enclosing `this` instead of rebinding it, which removes
  a class of defects when a function is passed as a callback, and a `const`
  binding cannot be used before it is initialized, so module ordering stays
  explicit instead of depending on hoisting.
- **Verification:** `func-style`, `prefer-arrow-callback` and the
  `no-restricted-syntax` selector in the shared ESLint configuration reject
  declarations, function callbacks and function expressions bound to a
  variable. Review the recorded reason next to each remaining `function`.
- **Sources:** [ESLint `func-style`](https://eslint.org/docs/latest/rules/func-style), [ESLint `prefer-arrow-callback`](https://eslint.org/docs/latest/rules/prefer-arrow-callback), [MDN arrow function expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions), practitioner experience with production TypeScript applications.
- **Exceptions:** The four cases named in the requirement are the complete
  list. A generator has no arrow form, so it keeps `function*`; where an ESLint
  suppression is needed it states the same reason and stays at the narrowest
  scope.

## `CORE-DEBT-001` — visible and actionable debt

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Remove dead code instead of commenting it out. Every `TODO`
  or `FIXME` marker references the issue that tracks it, in the form
  `TODO(#123)`.
- **Rationale:** Version control preserves removed code, and commented-out code
  drifts from the code around it until nobody can tell whether it still
  applies. A marker without an issue has no owner and no place in planning, so
  it tends to become permanent and lose its context.
- **Verification:** The `foundation/todo-issue-reference` rule in the shared
  ESLint configuration rejects a marker without an issue reference;
  `sonarjs/no-commented-code` rejects commented-out code.
- **Sources:** [SonarSource rule S125 — commented-out code](https://rules.sonarsource.com/javascript/RSPEC-125/), practitioner experience with production TypeScript applications.
- **Exceptions:** A project using a tracker whose references do not match
  `#123` configures its own pattern through the rule's `reference` option
  instead of dropping the rule. Work that the same change completes needs no
  marker at all.

## `CORE-SUPPRESS-001` — justified and narrow lint suppressions

- **Level:** MUST
- **Applies to:** all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Every ESLint disable directive names the rules it disables
  and states its reason after `--`, on the narrowest scope that works, for
  example `// eslint-disable-next-line sonarjs/no-os-command-from-path -- Git
  from the user's PATH by design`. A directive that no longer suppresses
  anything is removed.
- **Rationale:** A suppression is a local exception to a shared requirement. A
  reason records the decision for the reviewer and the next reader, a named
  rule keeps every other check active, and removing stale directives keeps the
  exceptions visible instead of letting them accumulate.
- **Verification:** `@eslint-community/eslint-comments/require-description`,
  `no-unlimited-disable` and the plugin's pairing rules reject undocumented or
  unbounded directives; `reportUnusedDisableDirectives` rejects stale ones.
- **Sources:** [ESLint — disabling rules with comments](https://eslint.org/docs/latest/use/configure/rules#disabling-rules), [eslint-plugin-eslint-comments](https://eslint-community.github.io/eslint-plugin-eslint-comments/), practitioner experience with production TypeScript applications.
- **Exceptions:** Generated code follows its generator's directives and is not
  edited manually.

## `CORE-COMPLEXITY-001` — bounded cognitive complexity

- **Level:** MUST
- **Applies to:** application and script source in all projects
- **Risk levels:** R1, R2, R3
- **Requirement:** Keep the cognitive complexity of each function at or below
  15 and control-flow nesting at or below four levels. Split a function that
  exceeds either bound into named units instead of suppressing the check.
- **Rationale:** Complexity concentrated in one function is where defects and
  regressions hide: it is harder to read, to test exhaustively and to change
  safely, for humans and for agents. Cognitive complexity penalizes nesting and
  broken linear flow, which tracks reading effort more closely than counting
  paths.
- **Verification:** `sonarjs/cognitive-complexity` and `max-depth` in the
  shared ESLint configuration. The preset also applies the SonarJS recommended
  rules for bug patterns and code smells; see the code health baseline in the
  [tooling reference](../tooling.md).
- **Sources:** [SonarSource — Cognitive Complexity](https://www.sonarsource.com/resources/cognitive-complexity/), [ESLint `max-depth`](https://eslint.org/docs/latest/rules/max-depth), practitioner experience with production TypeScript applications.
- **Exceptions:** A function whose complexity mirrors an external
  specification, such as a protocol state table, may keep it with a suppression
  that names the specification as its reason.
