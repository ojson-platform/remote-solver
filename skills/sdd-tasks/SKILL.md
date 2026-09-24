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

1. No `design.md`: stop.
2. Collect every Scenario in the delta. Cut them into slices.
3. `tasks.md`: lines `- [ ] \`<id>\`` in work order. Each line names its Scenario titles. `tasks/<id>.md` is the implementer's instruction: those titles, `## Сделать` (what changes, and what this task leaves untouched), `## Доказательство` (what the test observes, which files it may read, `pnpm run test:units:fast` and `pnpm run test:types`). Every file the implementer may edit is named there.
4. A technical task with no scenario points at a `design.md` item.
5. A foreign contract: a child issue labeled `Sandcastle` and `sdd:cycle`, body line `Parent: #<issue>`. A neighbor cycle already covers that contract: do not duplicate it, add `Depends: #<issue>`. A service with no cycle: an ordinary issue and `Depends: #<issue>`.
6. A scenario in two tasks, a scenario in none, or a task with no anchor: fix that before the commit.
7. `improve-tasks`: a thread marked `sdd:layer=tasks` gets its own commit, reply `sdd:fixed <commit>`, then resolve the thread.
8. Publish: `tasks.md`, `tasks/*.md`, and any uncommitted `openspec/` of this issue, message from the Commit section in `context.md`. Issue mirror: the Tasks line. Do not set `wait`.

## Check

- Every Scenario is in exactly one task
- Each task is one caller-visible path, or a design item
- Every foreign contract has a child or a `Depends`

## Stop

- Tasks are on the PR. The next machine run opens `implementing` once children are at least `specified`.
