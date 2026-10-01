---
name: sdd-plan
description: >
  Writes openspec/changes/issue-<issue>/proposal.md, commits it, and opens the
  pull request. Trigger: create-proposal, improve-proposal. Phase sdd:proposing.
mode: judgment
---

# sdd-plan

Records why and the scope. Zoom is context, not implementation. The commit and the pull request end this action. Commits land only on `sdd/<issue>`; the runtime already cut that branch. Do not create it.

## Out of this action

- Delta spec, design, tasks, code
- A new issue
- A problem statement that lives only in the issue body
- The `sdd:proposed` label, and merging

## Steps

1. No `proposal.md` yet: move the issue text into `openspec/changes/issue-<issue>/proposal.md`. Headings: `context.md` § Artifacts. An empty description stays a scaffold with its open questions as `- [ ]` items. Ids cut by `context.md` § Capability. Several services: what this change needs from each, no contracts. No child issues.
2. `proposal.md` already exists: leave it.
3. A question below the context zoom stays out of the proposal.
4. `improve-proposal`: Fix thread (`context.md`), layer `proposal`.
5. Publish (`context.md`). Mirror: `Change` and `Plan`. Open questions do not delay the pull request.
6. Open questions remain: Wait (`context.md`) with the questions.

## Check

- Problem, outcome, scope, and open questions are present
- Unresolved questions are `- [ ]` items
- No signatures and no implementation in the proposal
- The PR title starts with `#<issue>:`
- Each id is one rule: a rule change touches one spec. A rule the caller already observes is under `### Modified`
- The proposal commit is on the open PR

## Stop

- Publish. The machine opens the review gate. Leave `sdd:proposed` unset.
- Open questions at the context zoom: Publish, then Wait with the questions. Leave the phase open.
