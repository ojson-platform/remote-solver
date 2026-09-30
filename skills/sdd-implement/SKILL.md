---
name: sdd-implement
description: >
  Implements one task: a test that was red, then code, then the checkbox,
  one commit. Follows tasks/<id>.md and does not explore the repo.
  Trigger: implement-next-task. Phase sdd:implementing.
mode: mechanical
---

# sdd-implement

One task per run. One commit: test, code, checkbox. The task file is the instruction. Do not invent a design.

## Read only

The headings below are `context.md` § Artifacts.

1. The first `- [ ]` line in `openspec/changes/issue-<issue>/tasks.md`. The backtick id is the task.
2. `openspec/changes/issue-<issue>/tasks/<id>.md`.
3. The Scenario blocks that line names, in the delta spec only.
4. `## Verification boundary` in `design.md`.
5. Files named in the task file.

A file the task does not name stays unread and unedited: other changes, ADRs, a directory listing of `src`.

## Out of this action

- Behavior absent from the named scenarios
- Edits to spec, design, proposal, or another task's checkbox
- More than one task
- Review threads

## Steps

1. No `tasks/<id>.md`, or it lacks a § Artifacts heading: Hand-off to `tasks` on that line of `tasks.md`. Do not reconstruct the task from the code.
2. The named scenarios do not contain the behavior the task asks for: Hand-off to `spec` on the scenario closest to it. Write no code.
3. The task does not fit one commit: split `tasks.md` in its own commit and keep the scenario links. Publish after that commit and end the run.
4. Write the test only. Each test name contains its Scenario title. The test observes only what `## Доказательство` says.
5. Run `pnpm run test:units:fast`. Exit 0: the test does not pin the behavior. Rewrite the test. Do not edit `src` until a run exits non-zero.
6. Edit `src` only as `## Сделать` says. Run `pnpm run test:units:fast` and `pnpm run test:types`. Both exit 0. A failure outside this task: revert the code and Hand-off to `code` on the failing file, cause the failing test.
7. Check this task's `- [x]` only. One commit naming `<id>`. Publish (`context.md`). Mirror: `Tasks`.

## Check

- The task's test was red before any `src` edit
- The code adds no behavior outside `## Сделать`
- The checkbox lands in the same commit as the code

## Stop

- Publish. The phase stays `implementing`.
- Hand-off on a task file, a scenario, or a failing file outside the task, as the step says.
