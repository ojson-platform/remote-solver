---
name: sdd-design
description: >
  Writes design.md: verification boundary, external contracts, technical
  prerequisites, open decisions.
  Trigger: create-design, improve-design. Phase sdd:designing.
mode: judgment
---

# sdd-design

Writes the technical decision for this change.

## Out of this action

- Code, tests, spec, proposal, tasks
- A rollout plan
- The `sdd:designed` label

## Steps

1. `design.md` is already right and `threads <pull> --layer design` is empty: go to step 5.
2. Otherwise write `design.md` by `context.md` § Artifacts. The verification boundary names every capability.
3. No decision yet: an open decision item. Leave it open.
4. `improve-design`: Fix thread (`context.md`), layer `design`.
5. Publish (`context.md`). Mirror: `Design`. Open decisions do not delay the push.
6. An open decision remains: Wait (`context.md`) with the open decision.

## Check

- Every § Artifacts section of `design.md` is present
- Every capability names its verification boundary
- The text agrees with the proposal and the spec
- Nothing manual remains after merge

## Stop

- Publish. The machine opens the review gate.
- An open decision: Publish, then Wait with the open decision.
- The spec does not give a capability enough behavior to name its boundary: Hand-off to `spec` on that requirement.
