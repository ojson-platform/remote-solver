---
name: sdd-implement
description: >
  Implements one task: a test that was red, then code, then the checkbox,
  one commit. Follows tasks/<id>.md and does not explore the repo.
  Trigger: implement-next-task, fix-implementation. Phase sdd:implementing.
mode: mechanical
---

# sdd-implement

One task per run. One commit: test, code, checkbox. The task file is the instruction. Do not invent a design.

## Read only

1. The first `- [ ]` line in `openspec/changes/issue-<issue>/tasks.md`. The backtick id is the task.
2. `openspec/changes/issue-<issue>/tasks/<id>.md`.
3. The Scenario blocks that line names, in the delta spec only.
4. `## Verification boundary` in `design.md`.
5. Files named in the task file.

Do not open other changes, other skills, `machine/flow.ts`, ADRs, or a directory listing of `src`. A file the task does not name stays unread and unedited.

## Out of this action

- Behavior absent from the named scenarios
- Edits to spec, design, proposal, or another task's checkbox
- More than one task
- Threads of other layers

## implement-next-task

1. No `- [ ]` line: stop.
2. No `tasks/<id>.md`, or it has no `## Сделать` or no `## Доказательство`: stop. Do not reconstruct the task from the code.
3. The named scenarios do not contain the behavior: stop. Write no code. Do not edit the spec.
4. The task does not fit one commit: split `tasks.md` in its own commit and keep the scenario links. Stop after that commit.
5. Write the test only. Each test name contains its Scenario title. The test observes only what `## Доказательство` says.
6. Run `pnpm run test:units:fast`. Exit 0: the test does not pin the behavior. Rewrite the test. Do not edit `src` until a run exits non-zero.
7. Edit `src` only as `## Сделать` says. Run `pnpm run test:units:fast` and `pnpm run test:types`. Both exit 0. A failure outside this task: revert the code and stop.
8. Check this task's `- [x]` only. One commit `#<issue>: <id>`, then Publish. Issue mirror: the Tasks line.

## fix-implementation

1. Threads marked `sdd:layer=code`, from a reviewer or from `sdd-verify`. A remark about behavior: stop.
2. Read only the files those threads cite and the task file for that code. A separate commit with no new open checkbox, then Publish. A coverage gap: add the test and a closed `- [x]` line in `tasks.md` in that same commit.
3. In each thread, reply `sdd:fixed <commit>` and resolve it.

## Check

- The task's test was red before any `src` edit
- The code adds no behavior outside `## Сделать`
- The checkbox lands in the same commit as the code

## Stop

- The commit is on the PR. The phase stays `implementing`.
- No spec for the behavior: the rollback to `specifying` comes from a thread, not from this skill.
