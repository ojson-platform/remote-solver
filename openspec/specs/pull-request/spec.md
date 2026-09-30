# pull-request

## Purpose

A cycle has one open pull request. The title links the pull request to the issue.

## Requirements

### Requirement: Several open pull requests stop the cycle before any step

When more than one open pull request belongs to the issue, the machine SHALL wait and name them, and SHALL NOT enter a phase, close a gate, archive, run a skill, or follow a marker, until one open pull request remains.

#### Scenario: Two open pull requests stop proposing

- **WHEN** the phase is `proposing` and two open pull requests belong to the issue
- **THEN** the machine waits and names both, and does not open the review gate

#### Scenario: A gate label does not move while two pull requests are open

- **WHEN** a person has set `proposed` on a ready proposal and two pull requests are open
- **THEN** the phase stays where it is and the machine names both pull requests

#### Scenario: Two open pull requests block entering the cycle

- **WHEN** an issue has no phase and two open pull requests belong to it
- **THEN** the machine does not set `proposing`

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
