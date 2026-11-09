mode: mechanical

# sdd-fix

Fixes what the review found in the code. The threads are the instruction; the task file of that code is the boundary. Reads, edits, and check commands follow `CONTEXT.md` § Once.

## Out of this action

- Behavior the scenarios do not describe
- A new task, a new scenario, an edit to spec, design, or proposal
- Threads of other layers

## Read only

1. `threads <pull> --layer code`, and `conversation` from the same output.
2. The files those threads cite, and the task file under `tasks/` for that code.
3. The Scenario blocks that task names, in the delta spec only.

## Steps

1. Fix thread (`CONTEXT.md`), layer `code`. One commit per thread, no new open checkbox. A coverage gap takes **Implement the task**: **Write the test red**, then **Edit source code**, for the scenario the gap names. The commands are the ones in that code's task card. Do not look them up again. While the repair changes a test or source, run the one-file command from that card. After it exits 0, and before the commit, run the layer command once, and the fast suite and the type check once when the card names them (`CONTEXT.md` § Once). A layer failure in a file the thread cites returns to the one-file command, then the layer command runs once more. A layer failure outside those files is a Hand-off to `code` on the failing file, and the layer command does not run again. The commit also closes a `- [x]` line in `tasks.md`. A defect a CI check names, when no task card lists that check: repair it with the command in the Hand-off cause.
2. The pull request conflicts with its base: § Onto the base (`CONTEXT.md`). No open `code` thread means the machine sent this action for the conflict. A person's instruction arrives as a thread of this layer, and step 1 carries it out.
3. A thread that asks for behavior the scenarios do not describe: Hand-off to `spec` by replying in that thread. Leave it open.
4. Publish (`CONTEXT.md`). When this step fixes a code thread, focus with marker `sdd:focus:code`. Mirror: `Tasks` when a checkbox changed.

## Check

- Every `code` thread is closed by `thread fix`, or carries a Hand-off
- The code adds no behavior outside the scenarios of its task
- The tree is rebased when the pull request conflicts with its base

## Stop

- Publish. The phase stays `implementing`.
- Hand-off to `spec` for a remark about behavior.
