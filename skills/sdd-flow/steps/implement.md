mode: mechanical

# sdd-implement

One task per run. One commit: test, code, checkbox. The task file is the instruction. Do not invent a design.

## Read only

The headings below are `CONTEXT.md` § Artifacts.

1. The first `- [ ]` line in `openspec/changes/issue-<issue>/tasks.md`. The backtick id is the task.
2. `openspec/changes/issue-<issue>/tasks/<id>.md`.
3. The Scenario blocks that line names, in the delta spec only.
4. Files named in the task file.

A file the task does not name stays unread and unedited: other changes, ADRs, a directory listing of the files in `## Source`.

## Out of this action

- Behavior absent from the named scenarios
- Edits to spec, design, proposal, or another task's checkbox
- More than one task
- Review threads

## Steps

1. No `tasks/<id>.md`, or it lacks a § Artifacts heading: Hand-off to `tasks` on that line of `tasks.md`. Do not reconstruct the task from the code.
2. The named scenarios do not contain the behavior the task asks for: Hand-off to `spec` on the scenario closest to it. Write no code.
3. The task does not fit one commit: split `tasks.md` in its own commit and keep the scenario links. Publish after that commit and end the run.
4. **Implement the task.** For each scenario the task names, do 4.1 and then 4.2 before the next scenario. The substeps still hold. One commit covers the whole task.
   4.1 **Write the test red.** The test file is the path in `## Proof`. The test name contains this scenario's title. The test observes only what `## Proof` says. Run the one-file command from `## Proof`. Red is the test whose name contains this scenario's title failing on its assertion or on behavior that is not there yet. Exit 0, a test file that does not load, or a run that collects no test is not red: rewrite the test. Do not edit a file from `## Source` before the command is red.
   4.2 **Edit source code** only as `## Source` says, and only enough for this scenario. Run that same one-file command and the layer command from the card. Both exit 0. Run the fast suite and the type check when the card names them. A failure outside this task: revert the code and Hand-off to `code` on the failing file, cause the failing test. Do not choose a command the card did not write.
5. Check this task's `- [x]` only. One commit naming `<id>`. Publish (`CONTEXT.md`). Mirror: `Tasks`.

## Check

- The task's test was red before any edit of a file from `## Source`
- The code adds no behavior outside `## Source`
- The checkbox lands in the same commit as the code

## Stop

- Publish. The phase stays `implementing`.
- Hand-off on a task file, a scenario, or a failing file outside the task, as the step says.
