---
name: sdd-verify
description: >
  Classifies failing pull request checks. Writes no files.
  Trigger: classify-failures. Phase sdd:verifying.
mode: judgment
---

# sdd-verify

Classifies red PR checks. Writes no files and makes no commits. The result is a Hand-off per failure, which the skill of that layer picks up on the next run.

## Out of this action

- Editing the spec to turn a check green
- Writing code or a test

## Steps

1. Run `npx sdd checks <pr>` and read the failed job logs.
2. For each check failure: an implementation defect, a coverage gap, infrastructure, or an OpenSpec validate failure. Match a Scenario when one exists.
3. Defect or coverage gap: Hand-off (`context.md`) to `code` on the file the failure points at. Behavior that differs from the Scenario is a behavior change, not a defect: Hand-off to `spec` on that scenario.
4. An OpenSpec validate failure names spec files in the log: one Hand-off to `spec` per file, on that file, with the validator line as the cause. A validate failure that names no file is infrastructure.
5. Infrastructure only: `thread say <pull> 'sdd:note <cause>'`, then Wait with what is broken and what the person does.

## Check

- Every failure has a thread with a cause
- The spec is unchanged

## Stop

- Every failure carries a Hand-off. The machine points the phase at the earliest marker.
- Infrastructure only: Wait.
