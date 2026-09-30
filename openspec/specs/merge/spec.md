# merge

## Purpose

The machine merges only on `accepting` with `auto-merge`. The issue closes only after the pull request is merged.

## Requirements

### Requirement: An early archived change is restored

On a phase at or before `tasking`, an archived change SHALL be returned to the active change before any other step of that phase.

#### Scenario: Tasking restores an archived change

- **WHEN** the phase is `tasking` and the change is already archived
- **THEN** the machine restores the change and does not write tasks

#### Scenario: An archived change is restored before an unlabeled thread

- **WHEN** the phase is `tasking`, the change is archived, and an open thread has no marker
- **THEN** the machine restores the change and does not classify the thread

### Requirement: Accepting archives before it merges

On `accepting`, a change that is not archived SHALL be archived before the merge wait, once a pull request exists. With no pull request and nothing merged, the machine SHALL wait and SHALL NOT archive yet. After the archive, green checks and `auto-merge` SHALL merge. Green checks without `auto-merge` SHALL wait for a person to merge. Checks that are not green SHALL wait, including when `auto-merge` is set.

#### Scenario: Accepting archives a change that is still open

- **WHEN** the phase is `accepting`, a pull request is open, and the change is not archived
- **THEN** the machine archives the change and does not merge yet

#### Scenario: Accepting with no pull request does not archive

- **WHEN** the phase is `accepting` and the issue has no pull request and nothing merged
- **THEN** the machine waits and does not archive the change

#### Scenario: Auto-merge merges a green archived pull request

- **WHEN** `accepting` has an archived change, green checks, and `auto-merge`
- **THEN** the machine merges that pull request

#### Scenario: Without auto-merge the person merges

- **WHEN** `accepting` has an archived change and green checks, and `auto-merge` is absent
- **THEN** the machine waits for a person to merge

#### Scenario: Auto-merge waits for green checks

- **WHEN** `accepting` has `auto-merge` and the checks are not green
- **THEN** the machine waits and does not merge

### Requirement: Accepted does not merge

The `accepted` label SHALL NOT merge. `auto-merge` on `accepted` SHALL be ignored. A change that is still open and still has a proposal or a delta SHALL be archived first. When the pull request is merged and the change is archived, the machine SHALL set `accepted` and close the issue. The close comment SHALL say that the pull request is merged and the baseline is in trunk. An open pull request SHALL leave the issue open.

#### Scenario: Accepted with an open change archives it

- **WHEN** the phase is `accepted`, the pull request is already merged, and the change still has a proposal
- **THEN** the machine archives the change and does not close the issue yet

#### Scenario: A merged archived pull request closes the issue

- **WHEN** the phase is `accepted`, the change is archived, and the pull request is merged
- **THEN** the machine closes the issue

#### Scenario: Accepted waits while the pull request is open

- **WHEN** the phase is `accepted`, the change is archived, and the pull request is still open
- **THEN** the issue stays open and the machine does not merge, even when the checks are green and `auto-merge` is set
