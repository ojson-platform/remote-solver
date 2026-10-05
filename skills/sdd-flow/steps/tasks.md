mode: mechanical

# sdd-tasks

The implementation checklist. No human gate. A slice groups Scenarios the caller can verify together. It does not add behavior.

## Out of this action

- Code
- A new Scenario, a second change, a task with no scenario and no design item

## Slice

A slice is one caller-visible path. After this task lands, its Scenarios hold together.

- Scenarios that are the same observation share a slice. A deadline and the span it leaves are one path when the caller sees one fact.
- A later slice may assume the earlier slice's Scenarios already hold. Line order in `tasks.md` is that work order.
- Each Scenario sits in exactly one slice. The titles are copied from the delta.

Files are named only in the task card. The cut follows the caller path.

## Steps

1. Collect every Scenario in the delta. Cut them into slices.
2. `tasks.md` and one `tasks/<id>.md` per slice, by `CONTEXT.md` § Artifacts. The task file is the implementer's whole instruction. Copy the commands from `## Verification boundary` of the capabilities whose scenarios are in the slice. The test path in `## Proof` follows the boundary's path rule for the first file in `## Source`; without a rule, it sits beside that file. Replace `<test-file>` with that path, and copy the trace line with the commands. Do not look the commands up. A boundary with no command: Hand-off to `design` on that capability. Do not write the card. Do not invent a package command.
3. A technical task with no scenario points at a `design.md` item.
4. A foreign contract: a child issue labeled with the first queue `name` under `sdd.queues` in `openspec/config.yaml` and `sdd:cycle`, body line `Parent: #<issue>`. A neighbor cycle already covers that contract: do not duplicate it, add `Depends: #<issue>`. A service with no cycle: an ordinary issue and `Depends: #<issue>`.
5. A scenario in two tasks, a scenario in none, or a task with no anchor: fix that before the commit.
6. `improve-tasks`: Fix thread (`CONTEXT.md`), layer `tasks`.
7. Publish (`CONTEXT.md`): `tasks.md` and `tasks/*.md`. Mirror: `Tasks`.

## Check

- Every Scenario is in exactly one task
- Each task is one caller-visible path, or a design item
- Every foreign contract has a child or a `Depends`

## Stop

- Publish. The next machine run opens `implementing` once children are at least `specified`.
- A Scenario that no caller path can verify: Hand-off to `spec` on that scenario.
