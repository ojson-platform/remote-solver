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

### Requirement: Only green checks without a marker reach accepting

Checks that are neither red nor green SHALL wait. Green checks with a layer marker SHALL move to that phase. Green checks with no layer marker SHALL move to `accepting`.

#### Scenario: Pending checks wait

- **WHEN** `verifying` has checks that are still pending
- **THEN** the machine waits and does not move the phase

#### Scenario: Green checks with a design marker roll back

- **WHEN** `verifying` has green checks and a thread marks `design`
- **THEN** the machine moves the issue to `designing`

#### Scenario: Green checks move to accepting

- **WHEN** `verifying` has green checks and no layer marker
- **THEN** the machine moves the issue to `accepting`
