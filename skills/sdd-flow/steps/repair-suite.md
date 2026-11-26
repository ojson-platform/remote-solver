mode: mechanical

# sdd-repair-suite

Run the layer command once for this change. Fix one red file the run names, then run it once more. Reads and check commands follow `CONTEXT.md` § Once.

## Read only

1. `## Verification boundary` in `openspec/changes/issue-<issue>/design.md`.
2. The task cards under `openspec/changes/issue-<issue>/tasks/`, to see which files this change names.
3. The file a red run names.

## Out of this action

- A file the red run did not name
- A third run of the layer command
- A new scenario

## Steps

1. Run the layer command from the boundary once. Run the fast suite once when the boundary names it. Run the type check once when the boundary names it. Keep each command's own status, as § Once says. Do not invent a command.
2. Both green and the tree unchanged: do not commit. The review below publishes, with no commit.
3. A red layer command: one edit of the file the run named, including a file no card names. A `missing` or `outside` line that names a triple of this change lands on that spec's test file. `near` alone is not a Hand-off. Run the one-file command until it exits 0, then run the layer command once more. A second red layer command: Hand-off to `code`. Do not run it a third time. A coverage gap outside this task is a Hand-off to `code`, not a success. A thread open that exits non-zero: Wait (§ Wait), naming that file and the exit. Do not open a thread on another file.
4. A red type check after a green layer command: one edit of the file the type error names, including a file no card names. Run the type check once more. A second red type check: Hand-off to `code` on that file.
5. A commit of a fix does not move the phase. Do not Publish in this step. Do not call focus. When that commit contains a file no card names, the message says the tasks are done, names each such file, and says why it had to change. The review below publishes.
6. When the layer command and the type check are green, make the final review of sdd flow before Publish. The review returns findings and does not post, does not choose a line, and does not publish. An empty return list means the review is done.

   Post a thread only for a return. A leave is not a thread.

   For each return, `thread open <pull> <file> <line> '<body>'`. When no scenario names the promise, the lens is `spec`, the file is the delta spec that should name it, and the body starts with `sdd:layer=spec → specifying`, then the gap and the promise. Otherwise the file is that return's `where`, the line is a changed line of that file, and the body carries no marker. When the gap's line is outside the diff, use the nearest changed line in the same file. The rest of the body is plain English: the gap, then the promise.

   When a thread was opened, do not Publish. Stop. When there is no return and the tree is unchanged, Publish (`CONTEXT.md`) with no commit. The machine moves the phase. This step does not. When there is no return after the fix commit, Publish (`CONTEXT.md`). Do not call focus.

## Check

- The layer command ran at most twice
- `near` alone did not become a Hand-off
- An edited file no card names is named in the message, with why it had to change
- The review ran before Publish
- A return became a thread and Publish did not run
- A leave did not become a thread

## Stop

- Publish when the layer command and the type check are green and the review has no return.
- Stop without Publish when a thread was opened.
- Hand-off to `code` on a second red layer command, a second red type check, or a coverage gap outside this task.
- Wait when `thread open` for that Hand-off exits non-zero.
