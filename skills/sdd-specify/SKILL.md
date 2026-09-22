---
name: sdd-specify
description: >
  Writes the OpenSpec delta: requirements and scenarios.
  Trigger: create-initial-specs, improve-specs. Phase sdd:specifying.
mode: judgment
---

# sdd-specify

Writes observable behavior. Zoom is the black box.

## Out of this action

- Tests, commands, source paths, function names
- Code, and edits to `proposal.md`
- The verification boundary: that is `design.md`
- Restoring a baseline: that is `sdd-baseline`
- The `sdd:specified` label

## Steps

1. No accepted `proposal.md`: stop.
2. A `### Modified` capability has no `openspec/specs/<id>/spec.md`: stop. That action is `sdd-baseline`.
3. The delta exists and still matches the proposal: leave it and go to Publish.
4. Run `openspec instructions specs --change issue-<issue> --json`. Write `openspec/changes/issue-<issue>/specs/<capability>/spec.md` from its `template`. A scenario is checked from outside, without reading code.
5. A local proposal change: edit only the scenarios it touches.
6. `improve-specs`: a thread marked `sdd:layer=spec` gets its own commit, reply `sdd:fixed <commit>`, then resolve the thread.
7. Publish: the delta and any uncommitted `openspec/` of this issue, message `#<issue>: <what changed>`.
8. Issue mirror (`context.md`): the Specify line. The issue has `sdd:auto-spec`: do not set `sdd:wait-human`. Otherwise `npx tsx .sandcastle/sdd.ts wait <issue>`.

## Check

- Every Requirement has a Scenario
- No stack and no verification boundary
- Old scenarios stay unless the proposal dropped them

## Stop

- The spec is on the PR. With `sdd:auto-spec`, stop without a wait. Without it, wait for review.
- The proposal needs a change: stop. Keep the spec files.
