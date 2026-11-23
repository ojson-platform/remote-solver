mode: mechanical

# sdd-repair-suite

Run the layer command once for this change. Fix one red file the run names, then run it once more. Reads and check commands follow `CONTEXT.md` § Once.

## Read only

1. `## Verification boundary` in `openspec/changes/issue-<issue>/design.md`.
2. The task cards under `openspec/changes/issue-<issue>/tasks/`, to see which files this change names.
3. The file a red run names.

## Out of this action

- A file no card of this change names, except to place a Hand-off on it
- A third run of the layer command
- A new scenario

## Steps

1. Run the layer command from the boundary once. Run the fast suite once when the boundary names it. Run the type check once when the boundary names it. Keep each command's own status, as § Once says. Do not invent a command.
2. Both green and the tree unchanged: Publish (`CONTEXT.md`) with no commit. The machine moves the phase. This step does not.
3. A red layer command: one edit of the file the run named. That file is a test or source a card of this change names. A `missing` or `outside` line that names a triple of this change lands on that spec's test file. A failure in a file no card names: Hand-off to `code` on that file. Do not edit it. A thread open that exits non-zero: Wait (§ Wait), naming that file and the exit. Do not open a thread on another file. `near` alone is not a Hand-off. Run the one-file command until it exits 0, then run the layer command once more. A second red layer command: Hand-off to `code`. Do not run it a third time. A coverage gap outside this task is a Hand-off to `code`, not a success.
4. A red type check after a green layer command: one edit of the file the type error names, when a card of this change names that file. Run the type check once more. A second red type check: Hand-off to `code` on that file. Do not edit a file no card names.
5. A commit of a fix does not move the phase. Publish (`CONTEXT.md`). Do not call focus.

## Check

- The layer command ran at most twice
- `near` alone did not become a Hand-off
- A file no card names was not edited

## Stop

- Publish when the layer command and the type check are green.
- Hand-off to `code` on a second red layer command, a second red type check, or a file no card names.
- Wait when `thread open` for that Hand-off exits non-zero.
