mode: mechanical

# sdd-tasks

The implementation checklist. No human gate. A slice groups Scenarios the caller can verify together. It does not add behavior.

## Out of this action

- Code
- A new Scenario, a second change, a task with no scenario and no design item

## Slice

A slice is one caller-visible path. After this task lands, its Scenarios hold together.

- Scenarios that are the same observation share a slice. Two wordings of one fact the caller sees are one slice.
- A later slice may assume the earlier slice's Scenarios already hold. Line order in `tasks.md` is that work order.
- Each Scenario sits in exactly one slice. The titles are copied from the delta.

Files are named only in the task card. The cut follows the caller path.

## Steps

An open thread of layer `tasks`: steps 1–5 do not write the task files again. Step 6 still fixes a scenario in two tasks, in none, or a task with no anchor. Step 7 runs in that same pass.

1. § Upstream says the previous artifact has not changed and there is no open tasks thread: go to step 8. An open tasks thread does not cut slices in this step. When there is no open tasks thread and the block says `tasks.md` does not exist yet: collect every Scenario in the delta and cut them into slices. A diff: cut slices for the facts in the block. A scenario the diff drops leaves its task.
2. `tasks.md` and one `tasks/<id>.md` per slice, by `CONTEXT.md` § Artifacts. The task file is the implementer's whole instruction. Copy the commands from `## Verification boundary` of the capabilities whose scenarios are in the slice. The test path in `## Proof` follows the boundary's path rule for the first file in `## Source`; without a rule, it sits beside that file. Replace `<test-file>` with that path, and copy the trace line with the commands. In `## Proof`, write the timing beside them: the one-file command is the check on each attempt, and the layer command, with the fast suite and the type check when the boundary names them, runs once after that command exits 0. Do not look the commands up. A boundary with no command: Hand-off to `design` on that capability. Do not write the card. Do not invent a package command.
3. A technical task with no scenario points at a `design.md` item.
4. Compute the seams of this change. A seam does not by itself create a child issue.
5. A foreign contract: a child issue labeled with the first queue `name` under `sdd.queues` in `openspec/config.yaml` and `sdd:cycle`, then `node scripts/sdd.mjs link <child> parent <issue>`. A neighbor cycle already covers that contract: do not duplicate it, run `node scripts/sdd.mjs link <issue> depends-on <other>`. A service with no cycle: an ordinary issue and `node scripts/sdd.mjs link <issue> depends-on <other>`.
6. A scenario in two tasks, a scenario in none, or a task with no anchor: fix that before the commit.
7. `improve-tasks`: Fix thread (`CONTEXT.md`), layer `tasks`.
8. Publish (`CONTEXT.md`): `tasks.md` and `tasks/*.md`. Focus with marker `sdd:focus:tasks`. Mirror: `Tasks`.

## Check

- Every Scenario is in exactly one task
- Each task is one caller-visible path, or a design item
- The seams of this change are computed. A seam has no child issue of its own
- Every foreign contract has a child with a parent link, or a depends-on link on this issue

## Stop

- Publish. The next machine run opens `implementing` once children are at least `specified`.
- A Scenario that no caller path can verify: Hand-off to `spec` on that scenario.
