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

1. No delta spec: stop.
2. `design.md` is already right: leave it and go to Publish.
3. Otherwise three sections, each filled or `none`: the verification boundary per capability; external contracts (what another service must provide, not its API); technical prerequisites. Each prerequisite is code in this PR, an issue `Depends: #N`, or a flag with a safe default.
4. No decision yet: a `- [ ]` item under `## Open decisions`. Leave it open.
5. `improve-design`: a thread marked `sdd:layer=design` gets its own commit, reply `sdd:fixed <commit>`, then resolve the thread.
6. Publish: `design.md` and any uncommitted `openspec/` of this issue, message from the Commit section in `context.md`. Open decisions do not delay the push.
7. Issue mirror (`context.md`): the Design line. The issue has `sdd:auto-design` and `## Open decisions` has no `- [ ]`: do not set `sdd:wait-human`. Otherwise `npx remote-solver wait <issue> '<the open decision, or review the design and remote-solver accept <issue>>'`.

## Check

- The three sections are present
- Every capability names its verification boundary
- The text agrees with the proposal and the spec
- Nothing manual remains after merge

## Stop

- The design is on the PR. With `sdd:auto-design` and no open decision, stop without a wait. Without the tag, wait for the reviewer.
- An open decision: leave the phase open.
