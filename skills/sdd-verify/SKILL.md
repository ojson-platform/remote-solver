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

1. Run `pnpm run openspec:validate`. Exit 0: this command adds no thread. Exit non-zero: one review thread per spec file the output names, on that file, `sdd:layer=spec → specifying` and the validator line as the cause. A failure that names no file is infrastructure.
2. Run `npx remote-solver checks <pr>` and read the failed job logs.
3. For each check failure: an implementation defect, a coverage gap, or infrastructure. Match a Scenario when one exists.
4. Behavior that differs from the Scenario is a behavior change, not a defect.
5. Open a review thread (`context.md`) on the file the failure points at, on the PR head commit. Defect or coverage gap: `sdd:layer=code → implementing <cause>`. Behavior change: `sdd:layer=spec → specifying <cause>`.
6. Do not set the phase label. The machine moves to the earliest marker on the next poll.
7. Infrastructure only: one `sdd:note` thread with the cause, then `npx remote-solver wait <issue>`.

## Check

- Every failure has a thread with a cause
- The spec is unchanged

## Stop

- Every failure is on the PR as a thread with a layer marker. The machine points the phase at the earliest marker.
