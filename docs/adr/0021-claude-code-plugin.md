# ADR 0021: the repository is also a Claude Code plugin

- **Status:** proposed
- **Date:** 2026-10-05

## Context

Everything a project needs to stay on the foundation is now checked by the
generated project itself, for any person and any agent. Two things remain that
a lint gate cannot do: judging a change against its plan and the requirements
that need judgment, and stopping an agent from bypassing the gate or finishing
while it fails.

ADR 0001 keeps the foundation model-agnostic. The skill format is shared by
several agents; agents, hooks and marketplaces are specific to Claude Code.

## Decision

- Make the repository root a Claude Code plugin named `sef`, with a marketplace
  in the same repository, so the existing `skills/` ship unchanged and the
  knowledge stays in the repository rather than moving into the plugin.
- Add the `foundation-reviewer` agent and the `review` skill that runs it in a
  fresh context, applying the workflow mode: one pass reported to the person
  in `assisted` mode, at most three fix-and-review rounds in `autonomous` mode,
  and "To decide" items always handed to the person. The reviewer fixes only
  trivial problems, in a separate commit.
- Add the `record-exception` skill.
- Add a `PreToolUse` hook that blocks commands bypassing the Git hooks
  (`GIT-BYPASS-001`) and a `Stop` hook that runs `validate` when the code
  changed since it last passed, at most twice per unchanged failing state.

## Consequences

The plugin is a thin layer: the reviewer reads `docs/foundation/` and the plan
inside the project, and every deterministic check still lives in the project,
so people and other agents lose nothing by not using Claude Code.

The reviewer is a model: it can miss things and it shares blind spots with the
agent that wrote the code. It is anchored to the gate's result, the plan's
criteria and the requirements' verification fields to limit that, and the
person keeps the final decision in `assisted` mode.

The hooks protect sessions in Claude Code only; outside it, `lint` and the
pipeline still catch a bypassed hook. The stop hook can add minutes to the end
of a turn on large projects; `SEF_STOP_GATE_COMMAND` selects a faster check.
