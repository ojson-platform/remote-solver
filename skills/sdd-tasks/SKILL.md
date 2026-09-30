---
name: sdd-tasks
description: >
  Writes tasks.md as vertical slices of existing Scenarios. Creates child
  cycle issues when design needs another repository.
  Trigger: create-tasks, improve-tasks. Phase sdd:tasking.
mode: mechanical
---

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
2. `tasks.md` and one `tasks/<id>.md` per slice, by `context.md` § Artifacts. The task file is the implementer's whole instruction. Its commands are `pnpm run test:units:fast` and `pnpm run test:types`.
3. A technical task with no scenario points at a `design.md` item.
4. A foreign contract: a child issue labeled `Sandcastle` and `sdd:cycle`, body line `Parent: #<issue>`. A neighbor cycle already covers that contract: do not duplicate it, add `Depends: #<issue>`. A service with no cycle: an ordinary issue and `Depends: #<issue>`.
5. A scenario in two tasks, a scenario in none, or a task with no anchor: fix that before the commit.
6. `improve-tasks`: Fix thread (`context.md`), layer `tasks`.
7. Publish (`context.md`): `tasks.md` and `tasks/*.md`. Mirror: `Tasks`.

## Check

- Every Scenario is in exactly one task
- Each task is one caller-visible path, or a design item
- Every foreign contract has a child or a `Depends`

## Stop

- Publish. The next machine run opens `implementing` once children are at least `specified`.
- A Scenario that no caller path can verify: Hand-off to `spec` on that scenario.
