---
name: sdd-specify
description: >
  Writes the OpenSpec delta: requirements and scenarios.
  Trigger: create-initial-specs, improve-specs. Phase sdd:specifying.
mode: judgment
---

# sdd-specify

Writes observable behavior. Zoom is the black box. The delta grammar is `context.md` § Delta.

## Out of this action

- Tests, commands, source paths, function names
- Code, and edits to `proposal.md`
- The verification boundary: that is `design.md`
- The baseline of a capability
- The `sdd:specified` label

## Steps

1. The delta exists, still matches the proposal, and `threads <pull> --layer spec` is empty: go to step 5.
2. Run `openspec instructions specs --change issue-<issue> --json`. Write `openspec/changes/issue-<issue>/specs/<capability>/spec.md` from its `template`, sections by § Delta. A scenario is checked from outside, without reading code.
3. A local proposal change: edit the requirements and scenarios it changes, including ones it drops.
4. `improve-specs`: Fix thread (`context.md`), layer `spec`. A thread that drops a requirement or scenario writes that drop in the delta. `proposal.md` stays.
5. Run `openspec validate --all --strict --no-interactive`. Exit non-zero: fix every spec file the output names, then run it again. Do not publish while it fails.
6. Publish (`context.md`). Mirror: `Specify`.

## Check

- Every ADDED or MODIFIED Requirement has a Scenario. A dropped requirement is a name under `## REMOVED Requirements`. A dropped scenario is absent from the requirement that stays
- No stack and no verification boundary
- `openspec validate --all --strict --no-interactive` exits 0

## Stop

- Publish. The machine opens the review gate.
- The capability list, problem, or scope is wrong, or the delta would remove the last requirement of a baseline: Hand-off to `proposal` on the line of `proposal.md` that is wrong. Keep the spec files as they are. Dropping a requirement or scenario of a named capability stays in this action.
