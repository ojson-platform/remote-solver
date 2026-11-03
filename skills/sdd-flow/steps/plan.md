mode: judgment

# sdd-plan

Records why and the scope. Zoom is context, not implementation. The commit and the pull request end this action. Commits land only on `sdd/<issue>`; the runtime already cut that branch. Do not create it.

## Out of this action

- Delta spec, design, tasks, code
- A new issue
- A problem statement that lives only in the issue body
- The `sdd:proposed` label, and merging

## Steps

1. No `proposal.md` yet: write `openspec/changes/issue-<issue>/proposal.md` from the issue text in this prompt. Problem, Outcome, Scope, Out of scope, and Constraints keep the caller's words under the headings in `CONTEXT.md` § Artifacts. Capabilities is an id cut by § Capability. A behavior the issue says the caller already sees is Modified, even when `openspec/specs/<id>/spec.md` is absent. Read `openspec/specs/` only to reuse an id that is already this one rule. A wider spec is not this id. Do not read implementation, tests, or ADRs. An empty description stays a scaffold with its open questions as `- [ ]` items. Several services: what this change needs from each, no contracts. No child issues.
2. `proposal.md` already exists: leave it.
3. A question below the context zoom stays out of the proposal.
4. `improve-proposal`: Fix thread (`CONTEXT.md`), layer `proposal`. A thread on an open question records the answer and checks that item in the same commit, before a hand-off or `thread fix`. The hand-off is a new thread on the other layer's file.
5. Publish (`CONTEXT.md`). Mirror: `Change` and `Plan`. Open questions do not delay the pull request.
6. Open questions remain: Wait (`CONTEXT.md`) with the questions.

## Check

- Problem, outcome, scope, and open questions are present
- Unresolved questions are `- [ ]` items
- No signatures and no implementation in the proposal
- The PR title starts with `#<issue>:`
- Each id is one rule, not a screen, a file, or a module. A rule the caller already observes is under `### Modified`
- The proposal commit is on the open PR

## Stop

- Publish. The machine opens the review gate. Leave `sdd:proposed` unset.
- Open questions at the context zoom: Publish, then Wait with the questions. Leave the phase open.
