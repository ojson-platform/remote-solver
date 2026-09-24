---
name: sdd-baseline
description: >
  Restores openspec/specs/<capability>/spec.md from the code that already
  exists, before the delta is written. Recuts Capabilities ids in the
  proposal when they name files instead of rules.
  Trigger: restore-baseline. Phase sdd:specifying.
mode: judgment
---

# sdd-baseline

Writes the current behavior of a capability that has no baseline. One commit, before the delta.

## Out of this action

- The delta of this change
- The desired behavior
- A baseline of the whole repository

## Steps

1. Read Scope and `## Capabilities` in the proposal. Cut ids by the Capability section in `context.md`.
2. The cut is wrong when several ids name one rule, an id is a directory or a helper, or a rule the caller already observes sits under `### Added`. Rewrite the Capabilities lines so one rule is one id. Scope stays: names and the number of ids change, the change's contents do not.
3. Write `openspec/specs/<id>/spec.md` for each `### Modified` id that has no file yet.
4. The spec holds today's behavior of that rule, from code and tests, including disagreements between helpers. Requirement and Scenario. Leave a disputed point as the code behaves.
5. `## Out of scope` is another id. It stays out of this spec even when the code sits in the same file. An older proposal keeps that list inside its scope section under `Вне change`.
6. When the code does not show the behavior, stop and `npx remote-solver wait <issue> '<what the code does not show>'`.
7. Publish: the baseline spec and the id edit in the proposal, one commit, message from the Commit section in `context.md`, naming the capability. Do not set `wait`.
8. After the push, open an `sdd:note` thread on each disputed line of the pushed commit.

## Check

- The baseline states nothing the code does not do
- No paths and no function names
- Every `### Modified` id has `openspec/specs/<id>/spec.md`
- Every Requirement is needed to see the proposal's outcome; the rest is another id
- Scope is unchanged after the id edit

## Stop

- The baseline is on the PR. The next run writes the delta.
