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

An open thread of layer `spec`: steps 1–3 do not write the delta again.

1. § Upstream says the stamp matches, the delta exists, and `threads <pull> --layer spec` is empty: go to step 5. An open spec thread does not take step 3 and does not write the delta from the template. The block names an input revision, the delta exists, and there is no open spec thread: step 3, then step 5. Do not rewrite that delta from the template. Otherwise, when there is no open spec thread, write the delta. Do not judge a match from the whole proposal. Move `sdd-absorbed:` to that revision only when the input is folded.
2. Run `openspec instructions specs --change issue-<issue> --json`. Write `openspec/changes/issue-<issue>/specs/<capability>/spec.md` from its `template`, sections by § Delta. A scenario is checked from outside, without reading code. A sentence in the proposal Outcome or Constraints that names what the caller sees is a Scenario of this capability. The Scenario names each thing that sentence names. Another capability does not stand in for it. The Scenario's WHEN shows each of those things already visible. Its THEN states those same values.
3. When the block names an input revision: edit the requirements and scenarios that text changes, including ones it no longer names.
4. `improve-specs`: Fix thread (`CONTEXT.md`), layer `spec`. A thread that drops a requirement or scenario writes that drop in the delta. `proposal.md` stays. An answer that says what a named capability does rewrites that capability's scenario.
5. Run `openspec validate --all --strict --no-interactive`. A non-zero exit is § Delta. Do not publish while a spec this change owns fails.
6. Publish (`CONTEXT.md`). When a delta spec is in the commit, focus with marker `sdd:focus:spec`. Mirror: `Specify`.

## Check

- Every ADDED or MODIFIED Requirement has a Scenario. A dropped requirement is a name under `## REMOVED Requirements`. A dropped scenario is absent from the requirement that stays
- Every Outcome or Constraints sentence that names what the caller sees is a Scenario of this capability. Its WHEN shows each of those things already visible, and its THEN states those same values
- No stack and no verification boundary
- The specs this change owns pass `openspec validate --all --strict --no-interactive`

## Stop

- Publish. The machine opens the review gate.
- An answer that says what a named capability does: rewrite that capability's scenario. Do not add a capability. Do not hand that answer to `proposal`
- The capability list, problem, or scope is wrong, or the delta would remove the last requirement of a baseline: Hand-off to `proposal` on the line of `proposal.md` that is wrong. Keep the spec files as they are. Dropping a requirement or scenario of a named capability stays in this action.
