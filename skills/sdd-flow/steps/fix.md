mode: mechanical

# sdd-fix

Fixes what the review found in the code. The threads are the instruction; the task file of that code is the boundary.

## Out of this action

- Behavior the scenarios do not describe
- A new task, a new scenario, an edit to spec, design, or proposal
- Threads of other layers

## Read only

1. `threads <pull> --layer code`, and `conversation` from the same output.
2. The files those threads cite, and the task file under `tasks/` for that code.
3. The Scenario blocks that task names, in the delta spec only.

## Steps

1. Fix thread (`CONTEXT.md`), layer `code`. One commit per thread, no new open checkbox. A coverage gap takes **Implement the task**: **Write the test red**, then **Edit source code**, for the scenario the gap names. The commands are the ones in that code's task card. Do not look them up again. The commit also closes a `- [x]` line in `tasks.md`. A defect a CI check names, when no task card lists that check: repair it with the command in the Hand-off cause.
2. `conversation.layer` is `code`: a rebase or a merge conflict. Rebase `sdd/<issue>` onto the pull request base, edit only files git marks conflicted, Publish, then `thread fix <issue> <pull> --conversation`.
3. A thread that asks for behavior the scenarios do not describe: Hand-off to `spec` by replying in that thread. Leave it open.
4. Publish (`CONTEXT.md`). Mirror: `Tasks` when a checkbox changed.

## Check

- Every `code` thread is closed by `thread fix`, or carries a Hand-off
- The code adds no behavior outside the scenarios of its task
- The tree is rebased when the conversation asked for it

## Stop

- Publish. The phase stays `implementing`.
- Hand-off to `spec` for a remark about behavior.
