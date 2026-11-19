# pull-request

## Purpose

A cycle has one open pull request. The title links the pull request to the issue.

## Requirements

### Requirement: Several open pull requests hold the phase line

When more than one open pull request belongs to the issue, the machine SHALL wait and name them, and SHALL NOT enter a phase, leave a phase, close a gate, archive, or finish, until one open pull request remains. An archived change SHALL be restored before any other step, including an unlabeled thread. An unlabeled thread SHALL be classified before an open task. An open task on `implementing` SHALL still run once those two are clear.

#### Scenario: Two open pull requests stop proposing

- **WHEN** the phase is `proposing` and two open pull requests belong to the issue
- **THEN** the machine waits and names both, and does not open the review gate

#### Scenario: A gate label does not move while two pull requests are open

- **WHEN** a person has set `proposed` on a ready proposal and two pull requests are open
- **THEN** the phase stays where it is and the machine names both pull requests

#### Scenario: Two open pull requests block entering the cycle

- **WHEN** an issue has no phase and two open pull requests belong to it
- **THEN** the machine does not set `proposing`

#### Scenario: An archived change is restored while two pull requests are open

- **WHEN** `implementing` has an open task, the change is archived, and two open pull requests belong to the issue
- **THEN** the machine restores the change and does not run the task

#### Scenario: An unlabeled thread is classified while two pull requests are open

- **WHEN** `implementing` has an open task, the change is not archived, two open pull requests belong to the issue, and one of them has a thread with no marker
- **THEN** the machine classifies that thread and does not run the task

#### Scenario: An open task still runs while two pull requests are open

- **WHEN** `implementing` has an open task and two open pull requests belong to the issue
- **THEN** the machine runs that task and names neither pull request as a wait

#### Scenario: An open task still runs when one of two pull requests conflicts

- **WHEN** `implementing` has an open task and one of two open pull requests conflicts with the base
- **THEN** the machine runs that task and does not rebase

### Requirement: An untraced baseline runs before two pull requests hold the task

On `implementing`, an untraced baseline SHALL start `cover-baseline` before an open task, including when two pull requests are open and one conflicts. The machine SHALL NOT rebase for that conflict and SHALL NOT wait for one pull request to close.

#### Scenario: An untraced baseline runs while two pull requests are open

- **WHEN** `implementing` has an open task, an untraced baseline scenario, and two open pull requests
- **THEN** the machine runs `cover-baseline` and does not wait

#### Scenario: An untraced baseline runs when one of two pull requests conflicts

- **WHEN** `implementing` has an open task, an untraced baseline scenario, and one of two open pull requests conflicts
- **THEN** the machine runs `cover-baseline` and does not rebase

### Requirement: An earlier thread and a card gap come before two pull requests

An earlier-phase thread SHALL move the phase before an open task on two pull requests. A card gap SHALL return to `tasking` before that task.

#### Scenario: An earlier-phase thread moves while two pull requests are open

- **WHEN** `implementing` has an open task, two open pull requests belong to the issue, and a thread marks `spec`
- **THEN** the machine moves the issue to `specifying` and does not run the task

#### Scenario: A card gap returns to tasking while two pull requests are open

- **WHEN** `implementing` has an open task, two open pull requests belong to the issue, and a delta scenario is named on no card
- **THEN** the machine returns to `tasking` and does not run the task

### Requirement: None creates a pull request, one is reused

`publish` on a clean tree SHALL push the issue branch. With no open pull request it SHALL open one using the given title. With one open pull request it SHALL keep that pull request and SHALL NOT open another. The title links a pull request to the issue only when it starts with `#<key>:` or `#<key> `.

#### Scenario: No open pull request is created with the given title

- **WHEN** `publish` runs on a clean tree and the issue has no open pull request
- **THEN** the branch is pushed and a pull request opens with the given title

#### Scenario: One open pull request is reused

- **WHEN** `publish` runs on a clean tree and the issue already has one open pull request
- **THEN** that pull request stays the cycle's pull request and no second one opens

#### Scenario: A title without the key prefix does not belong to the issue

- **WHEN** a pull request title does not start with `#<key>:` or `#<key> `
- **THEN** it is not a pull request of that issue
