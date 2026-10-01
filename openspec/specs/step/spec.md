# step

## Purpose

`step` settles one issue and prints its decision. `worktree` prepares that issue's session checkout.

## Requirements

### Requirement: Step settles one issue and prints its decision

`step <key>` SHALL apply that issue's mechanical phase moves and print the decision that stops the settlement. When that decision is a merge, `step` SHALL merge the pull request and print the following decision: the issue is `accepted` and closed, and the printed decision is `done`. It SHALL NOT start a skill. It SHALL NOT settle any other issue. Every printed decision SHALL carry `queue`, the machine's queue label, and `base`, the pull request base branch, including a decision printed because the issue is outside the cycle.

#### Scenario: One issue moves and another stays

- **WHEN** `step` is run for an issue that is `proposed` with no proposal, and another issue is `implementing` with an open task
- **THEN** the first issue moves to `proposing` and the printed decision is that issue's skill
- **AND** the implementing issue stays `implementing`
- **AND** no skill run starts

#### Scenario: A merge is performed

- **WHEN** the issue's decision is a merge
- **THEN** `step` merges that pull request once, the issue is `accepted` and closed, and the printed decision is `done`

#### Scenario: The printed decision names the queue and the base

- **WHEN** `step` is run for an issue in the cycle
- **THEN** the printed decision carries `queue` as the machine's queue label and `base` as the pull request base branch

#### Scenario: A decision outside the cycle still names them

- **WHEN** the issue is not in the cycle and `step` is run
- **THEN** the printed decision is `done` and still carries `queue` and `base`

### Requirement: Auto tags are written only inside the cycle

When `step` is given `--auto-plan`, `--auto-spec`, or `--auto-design`, it SHALL add `sdd:auto-plan`, `sdd:auto-spec`, or `sdd:auto-design` before settling, and only when the issue is in the open cycle. Outside the cycle it SHALL print `done` and add nothing.

#### Scenario: Auto-plan advances a ready proposal

- **WHEN** the issue is in the cycle on `proposing`, the proposal is published, nothing is open, and `step` is given `--auto-plan`, `--auto-spec`, and `--auto-design`
- **THEN** the issue carries `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design`, and has moved to `specifying`

#### Scenario: A flag outside the cycle writes nothing

- **WHEN** the issue is not in the cycle and `step` is given `--auto-plan`
- **THEN** the printed decision is `done` and `sdd:auto-plan` is absent

### Requirement: Worktree prepares the session checkout

`worktree <key>` SHALL check out branch `sdd/<key>` at `.worktrees/sdd-<key>`, creating the checkout when it is missing and reusing it when it exists, including when it is dirty. It SHALL print that checkout path. The package links SHALL be in that checkout. A dirty file SHALL remain. The service status SHALL NOT list `.worktrees`.

#### Scenario: A missing checkout is created

- **WHEN** `worktree` is run for an issue whose checkout is missing
- **THEN** `.worktrees/sdd-<key>` exists on branch `sdd/<key>`, the package links are present, and the printed path is that checkout
- **AND** the service status does not list `.worktrees`

#### Scenario: A dirty checkout is reused

- **WHEN** the checkout exists and contains an uncommitted file, and `worktree` is run again
- **THEN** that file is still there
