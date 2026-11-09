mode: judgment

# sdd-specify

Writes observable behavior. Zoom is the black box. The delta grammar is `CONTEXT.md` § Delta.

## Out of this action

- Tests, commands, source paths, function names
- Code, and edits to `proposal.md`
- The verification boundary: that is `design.md`
- The baseline of a capability
- The `sdd:specified` label

## Steps

An open thread of layer `spec`: Fix thread (`CONTEXT.md`), then step 5. Do not rewrite the delta in the steps in between.

1. § Upstream says the previous artifact has not changed, the delta exists, and `threads <pull> --layer spec` is empty: go to step 5. The upstream block is a diff and the delta exists: step 3, then step 5. Do not rewrite that delta from the template. Otherwise write the delta. Do not judge a match from the whole proposal.
2. Run `openspec instructions specs --change issue-<issue> --json`. Write `openspec/changes/issue-<issue>/specs/<capability>/spec.md` from its `template`, sections by § Delta. A scenario is checked from outside, without reading code. A sentence in the proposal Outcome or Constraints that names what the caller sees is a Scenario of this capability. The Scenario names each thing that sentence names. Another capability does not stand in for it. The Scenario's WHEN shows each of those things already visible, together with the other limit that can replace them. Its THEN states those same values.
3. A local proposal change: edit the requirements and scenarios it changes, including ones it drops.
4. `improve-specs`: Fix thread (`CONTEXT.md`), layer `spec`. A thread that drops a requirement or scenario writes that drop in the delta. `proposal.md` stays. A reply that says which write a named capability does not change rewrites that capability's scenario to that write.
5. Run `openspec validate --all --strict --no-interactive`. Exit non-zero on a spec this change owns: fix that file and run it again. A failure in a spec this change does not own: do not edit it. Do not publish while a spec this change owns fails.
6. Publish (`CONTEXT.md`). When a delta spec is in the commit, focus with marker `sdd:focus:spec`. Mirror: `Specify`.

## Check

- Every ADDED or MODIFIED Requirement has a Scenario. A dropped requirement is a name under `## REMOVED Requirements`. A dropped scenario is absent from the requirement that stays
- Every Outcome or Constraints sentence that names what the caller sees is a Scenario of this capability. Its WHEN shows each of those things already visible, together with the other limit that can replace them, and its THEN states those same values
- No stack and no verification boundary
- The specs this change owns pass `openspec validate --all --strict --no-interactive`

## Stop

- Publish. The machine opens the review gate.
- A reply that says which write a named capability does not change: rewrite that capability's scenario to that write. Do not add a capability. Do not hand off to `proposal`
- The capability list, problem, or scope is wrong, or the delta would remove the last requirement of a baseline: Hand-off to `proposal` on the line of `proposal.md` that is wrong. Keep the spec files as they are. Dropping a requirement or scenario of a named capability stays in this action.
