# verifying

## Purpose

`verifying` follows the pull request checks, and follows a marker only around those checks.

## Requirements

### Requirement: Verifying needs an open pull request

With no open pull request the machine SHALL wait. A merged pull request alone SHALL NOT satisfy this.

#### Scenario: Verifying without an open pull request waits

- **WHEN** the phase is `verifying` and the issue has no open pull request
- **THEN** the machine waits for an open pull request

### Requirement: Red checks follow a marker, otherwise they are classified

When the checks are red and a layer marker names a phase, the machine SHALL move to that phase. When the checks are red and no marker names a phase, the machine SHALL classify the failures.

#### Scenario: Red checks with a code marker return to implementing

- **WHEN** `verifying` has red checks and a thread marks `code`
- **THEN** the machine moves the issue to `implementing` and does not classify the failures

#### Scenario: Red checks with no marker are classified

- **WHEN** `verifying` has red checks and no layer marker
- **THEN** the machine classifies the failures and stays on `verifying`

### Requirement: A red run is named in the classify reason

The classify reason SHALL name each failed check by its name and the time that run completed, so two completions are different reasons. A cancelled check SHALL NOT be part of the name. When no failed check has a completion time, the reason SHALL stay `red checks`.

#### Scenario: Two completions of one check are different decisions

- **WHEN** one red run completed at one time and another completed later
- **THEN** the two classify reasons differ and each contains the check name and its time

#### Scenario: A cancelled check is not the name

- **WHEN** one check failed and a sibling was cancelled, or a failure has no completion time
- **THEN** the name is only the failed run, and a failure without a time keeps the reason `red checks`

### Requirement: Only green checks without a marker reach accepting

Checks that are neither red nor green SHALL wait, unless the open pull request conflicts with its base. Green checks with a layer marker SHALL move to that phase. Green checks with no layer marker SHALL move to `accepting`.

#### Scenario: Pending checks wait

- **WHEN** `verifying` has checks that are still pending
- **THEN** the machine waits and does not move the phase

#### Scenario: Green checks with a design marker roll back

- **WHEN** `verifying` has green checks and a thread marks `design`
- **THEN** the machine moves the issue to `designing`

#### Scenario: Green checks move to accepting

- **WHEN** `verifying` has green checks and no layer marker
- **THEN** the machine moves the issue to `accepting`

### Requirement: A merge conflict returns to implementing for a rebase

When the open pull request conflicts with its base, `verifying` SHALL move the issue to `implementing` and SHALL NOT wait on checks. On `implementing`, that conflict SHALL run the fix that rebases onto the base, before an open task and before the move to `verifying`.

#### Scenario: A conflicting pull request leaves verifying for a rebase

- **WHEN** the phase is `verifying`, no check is reported, and the open pull request conflicts with its base
- **THEN** the machine moves the issue to `implementing` and asks for the rebase

#### Scenario: Implementing rebases a conflicting pull request

- **WHEN** the phase is `implementing` and the open pull request conflicts with its base
- **THEN** the machine runs the fix that rebases and does not move to `verifying`
