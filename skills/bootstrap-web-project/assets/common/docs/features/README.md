# Features

Each feature that needs analysis before implementation gets a folder named by
its slug, for example `docs/features/flight-search/`, holding:

- `plan.md`: the analysis and the implementation plan, from
  [`_template/plan.md`](_template/plan.md). Required.
- `spec.md`: the page or component specification for user interface work, from
  [`_template/spec.md`](_template/spec.md), with its screenshots next to it.

Plans live in Git with the code they describe: they are the reviewer's
criteria and the project's memory of why the code is the way it is. Keep
decisions here or in `AGENTS.md`, never only in an agent's private memory.

`corepack yarn lint` checks every plan except the template: the front matter,
the required sections, no open blocking question once implementation starts,
and every acceptance criterion settled once the plan is done.
