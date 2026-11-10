mode: judgment

# sdd-verify

Classifies red PR checks. Writes no files and makes no commits. The result is a Hand-off per failure, which the skill of that layer picks up on the next run.

## Out of this action

- Editing the spec to turn a check green
- Writing code or a test

## Steps

1. `checks <pull>`, then read the failed job logs.
2. For each check failure: an implementation defect, a coverage gap, infrastructure, or an OpenSpec validate failure. When the failing test name contains a delta scenario title, read that scenario's THEN before the hand-off. The name contains the title because `scenario(title)` calls `it(title)`. A coverage line `missing|near|outside` is not a test name. The card's `Trace:` line does not print the title.
3. An assertion that expects that THEN and gets something else: Hand-off (`CONTEXT.md`) to `code` on the file the failure points at. An assertion that expects something other than that THEN: Hand-off to `spec` on that scenario. A failure whose name contains no scenario title stays a defect or a coverage gap: Hand-off to `code` on that file. The step does not open the design, the task list, or the proof section. This step writes no files.
4. An OpenSpec validate failure names spec files in the log: one Hand-off to `spec` per file, on that file, with the validator line as the cause. A validate failure that names no file is infrastructure.
5. Infrastructure only: `thread say <pull> 'sdd:note <cause>'`, then Wait with what is broken and what the person does.

## Check

- Every failure has a thread with a cause
- The spec is unchanged

## Stop

- Every failure carries a Hand-off. The machine points the phase at the earliest marker.
- Infrastructure only: Wait.
