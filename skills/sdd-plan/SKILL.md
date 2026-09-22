---
name: sdd-plan
description: >
  Writes openspec/changes/issue-<issue>/proposal.md, commits it, and opens the
  pull request. Trigger: create-proposal, improve-proposal. Phase sdd:proposing.
mode: judgment
---

# sdd-plan

Records why and the scope. Zoom is context, not implementation. The commit and the pull request end this action.

## Out of this action

- Delta spec, design, tasks, code
- A new issue
- A problem statement that lives only in the issue body
- The `sdd:proposed` label, and merging
- A run whose only job is the pull request

## Steps

1. Branch `sdd/<issue>` from `master` when it is missing. Commits land only there.
2. No `proposal.md` yet: move the issue text into `openspec/changes/issue-<issue>/proposal.md`. An empty description stays a scaffold with `## Open questions` as `- [ ]` items. Sections: `## Problem`, `## Outcome`, `## Scope`, `## Out of scope`, `## Constraints`, `## Capabilities`, `## Open questions`. `## Capabilities` has `### Added` and `### Modified`, lines `- <id> <gist>`. Cut ids by the Capability section in `context.md`. Several services: what this change needs from each, no contracts. No child issues.
3. `proposal.md` already exists: leave it.
4. A question below the context zoom stays out of the proposal.
5. `improve-proposal`: a thread marked `sdd:layer=proposal` gets its own commit, reply `sdd:fixed <commit>`, then resolve the thread.
6. Publish: the proposal and any uncommitted `openspec/` of this issue, message `#<issue>: <what changed>`. Open questions do not delay the pull request.
7. Issue mirror (`context.md`): the Change and Plan lines.
8. The issue has `sdd:auto-plan`: do not set `sdd:wait-human`. Otherwise `npx tsx .sandcastle/sdd.ts wait <issue>`.

## Check

- Problem, outcome, scope, and open questions are present
- Unresolved questions are `- [ ]` items
- No signatures and no implementation in the proposal
- The PR title starts with `#<issue>:`
- Each id is one rule: a rule change touches one spec. A rule the caller already observes is under `### Modified`
- The proposal commit is on the open PR

## Stop

- The proposal is on the PR. With `sdd:auto-plan`, stop without a wait. Without it, wait for review. Leave `sdd:proposed` unset.
- Open questions at the context zoom: wait the same way. Leave the phase open.
