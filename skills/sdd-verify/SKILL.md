---
name: sdd-verify
description: >
  Classifies failing pull request checks. Writes no files.
  Trigger: classify-failures. Phase sdd:verifying.
mode: judgment
---

# sdd-verify

Classifies red PR checks. Writes no files and makes no commits. The result is a review thread per failure, which the layer skill picks up on the next run.

## Out of this action

- Editing the spec to turn a check green
- Writing code or a test

## Steps

1. Run `npx remote-solver checks <pr>` and read the failed job logs.
2. For each check failure: an implementation defect, a coverage gap, infrastructure, or an OpenSpec validate failure. Match a Scenario when one exists. An OpenSpec validate failure names spec files in the log: one thread per file, on that file, `sdd:layer=spec → specifying`, with the validator line as the cause. A validate failure that names no file is infrastructure.
3. Behavior that differs from the Scenario is a behavior change, not a defect.
4. Open a review thread (`context.md`) on the file the failure points at, on the PR head commit. Defect or coverage gap: `sdd:layer=code → implementing <cause>`. Behavior change: `sdd:layer=spec → specifying <cause>`.
5. Do not set the phase label. The machine moves to the earliest marker on the next poll.
6. Infrastructure only: one `sdd:note` thread with the cause, then `npx remote-solver wait <issue> '<what is broken and what the person does>'`.

## Check

- Every failure has a thread with a cause
- The spec is unchanged

## Stop

- Every failure is on the PR as a thread with a layer marker. The machine points the phase at the earliest marker.
