# step

## Purpose

`step` settles one issue and prints its decision. `worktree` prepares that issue's session checkout.

## Requirements

### Requirement: Step settles one issue and prints its decision

`step <key>` SHALL apply that issue's mechanical phase moves and print the decision that stops the settlement.

When that decision is a merge, `step` SHALL merge the pull request and print the following decision: the issue is `accepted` and closed, and the printed decision is `done`.

It SHALL NOT start a skill.

It SHALL NOT settle any other issue.

Every printed decision SHALL carry `queue` and `base`, including a decision printed because the issue is outside the cycle.

#### Scenario: One issue moves and another stays

`queue` SHALL be the earliest configured queue whose name is in the issue labels.

When no configured queue name is in the labels, `queue` SHALL be the first configured queue name.

`base` SHALL be the pull request base branch.

An issue whose service field names a directory other than the service root SHALL wait with reason `service is` that directory and SHALL NOT move.

An empty service field SHALL mean the directory `step` was started from.

Text in the issue body SHALL NOT name the service.

- **WHEN** `step` is run for an issue that is `proposed` with no proposal, and another issue is `implementing` with an open task
- **THEN** the first issue moves to `proposing` and the printed decision is that issue's skill
- **AND** the implementing issue stays `implementing`
- **AND** no skill run starts

#### Scenario: A merge is performed

- **WHEN** the issue's decision is a merge
- **THEN** `step` merges that pull request once, the issue is `accepted` and closed, and the printed decision is `done`

#### Scenario: The printed decision names the queue and the base

- **WHEN** `step` is run for an issue in the cycle
- **THEN** the printed decision carries `queue` as that issue's queue and `base` as the pull request base branch

#### Scenario: The printed queue is the issue queue

- **WHEN** the issue labels include `SECOND` and `FIRST` and the configured queues are `FIRST` then `SECOND`
- **THEN** the printed `queue` is `FIRST` and `base` is the pull request base branch

#### Scenario: A decision outside the cycle still names them

- **WHEN** the issue is not in the cycle and `step` is run
- **THEN** the printed decision is `done` and still carries `queue` and `base`

#### Scenario: An unassigned issue is claimed

- **WHEN** the issue is in the cycle and has no assignee
- **THEN** `step` assigns it to the caller and prints that issue's decision

#### Scenario: Someone else's issue waits

- **WHEN** the issue is in the cycle and is assigned to another login
- **THEN** the printed decision is `wait` with reason `assigned to` that login, and the assignee stays

#### Scenario: A service field for another directory waits

- **WHEN** the issue service field names a directory that is not the service root
- **THEN** the printed decision is `wait` with reason `service is` that directory, and no phase move runs

#### Scenario: A Service line in the body is not the service

- **WHEN** the issue body contains `Service:` naming another directory and the service field is empty
- **THEN** `step` does not wait because of that line

### Requirement: Auto tags are written only inside the cycle

When `step` is given `--auto-plan`, `--auto-spec`, or `--auto-design`, it SHALL add `sdd:auto-plan`, `sdd:auto-spec`, or `sdd:auto-design` before settling, and only when the issue is in the open cycle. Outside the cycle it SHALL print `done` and add nothing.

#### Scenario: Auto-plan advances a ready proposal

- **WHEN** the issue is in the cycle on `proposing`, the proposal is published and names no capability, nothing is open, and `step` is given `--auto-plan`, `--auto-spec`, and `--auto-design`
- **THEN** the issue carries `sdd:auto-plan`, `sdd:auto-spec`, and `sdd:auto-design`, and has moved to `designing`

#### Scenario: A flag outside the cycle writes nothing

- **WHEN** the issue is not in the cycle and `step` is given `--auto-plan`
- **THEN** the printed decision is `done` and `sdd:auto-plan` is absent

### Requirement: The printed step carries the issue and the upstream

When the printed decision is an agent action, `step` SHALL be the issue text, then the upstream block, then the assembled step. The issue text SHALL tell the run not to search the repository for the issue and not to read the service source to recover it, and that instruction SHALL stand above the title and the body. An empty title SHALL stay empty. An empty body SHALL stay empty, and the text SHALL say the issue has no description.

For `plan`, the upstream block SHALL say the issue text is the upstream of `proposal.md`, that the file existing is not a reason to leave that sentence, and that a sentence the proposal already replaced is not copied back. The assembled step SHALL stand after that block.

#### Scenario: A plan step prints the issue above the upstream block

- **WHEN** `step` runs for a plan action and the issue has a title and a body
- **THEN** the printed `step` tells the run not to search the repository or read the service source, then contains that title and that body, then says the issue text is the upstream of `proposal.md`, and the step file stands after that sentence

#### Scenario: An empty description stays empty in the printed step

- **WHEN** `step` runs for a plan action and the issue body is empty
- **THEN** the printed `step` says the issue has no description and still tells the run not to search

### Requirement: A wait on an open item prints a dialog

When `step` waits because an item is open under `## Open questions` or `## Open decisions`, and that file is on the issue branch of the one open pull request, the printed decision SHALL carry `dialog`. Each entry SHALL be one unchecked item under that heading: its text, and a `record` that opens a thread on that line of the published file, with `<answer>` where the person's words go. A checked item SHALL be absent. An item under another heading SHALL be absent. A `wait` that is not these open items SHALL NOT carry `dialog`. When an open thread already sits on an open question, `step` SHALL print `improve-proposal` and SHALL NOT carry `dialog`.

#### Scenario: Open questions are printed as a dialog

- **WHEN** `step` waits on open questions in a published proposal
- **THEN** `dialog` lists each unchecked question under `## Open questions`, the record opens a proposal thread on that line with `<answer>`, and a checked item and an item under another heading are absent

#### Scenario: Open decisions are printed as a dialog

- **WHEN** `step` waits on open decisions in a published design
- **THEN** `dialog` lists each unchecked decision and the record opens a design thread on that line with `<answer>`

#### Scenario: A gate wait prints no dialog

- **WHEN** `step` waits on the proposal review gate
- **THEN** the printed decision has no `dialog`

#### Scenario: A thread on an open question is the proposal action

- **WHEN** an open question already has an open thread
- **THEN** `step` prints `improve-proposal` and does not carry `dialog`

### Requirement: Worktree prepares the session checkout

`worktree <key>` SHALL check out branch `sdd/<key>` at `.worktrees/sdd-<key>`, creating the checkout when it is missing and reusing it when it exists, including when it is dirty.

When that branch is already checked out in another worktree, `worktree` SHALL reuse that checkout and SHALL NOT add a second one.

The spy SHALL prepare this same checkout.

It SHALL print that checkout path.

The package links SHALL be in that checkout.

#### Scenario: A missing checkout is created

`.sandcastle/service-root` in that checkout SHALL name the service root `worktree` was run from.

A dirty file SHALL remain.

The service status SHALL NOT list `.worktrees`.

A `node_modules` link that already names the service `node_modules` SHALL stay pointed there when `worktree` runs again from that checkout.

- **WHEN** `worktree` is run for an issue whose checkout is missing
- **THEN** `.worktrees/sdd-<key>` exists on branch `sdd/<key>`, the package links are present, and the printed path is that checkout
- **AND** `.sandcastle/service-root` in that checkout names the service root
- **AND** the service status does not list `.worktrees`

#### Scenario: A dirty checkout is reused

- **WHEN** the checkout exists and contains an uncommitted file, and `worktree` is run again
- **THEN** that file is still there

#### Scenario: A branch already checked out elsewhere is reused

- **WHEN** branch `sdd/<key>` is already checked out outside `.worktrees` and that checkout contains an uncommitted file, and `worktree` is run
- **THEN** the printed path is that checkout, the file is still there, and `.worktrees/sdd-<key>` does not exist

#### Scenario: A checkout does not link node_modules to itself

- **WHEN** the session checkout links `node_modules` to the service `node_modules`, and `worktree` is run again from that checkout
- **THEN** `node_modules` still points at the service `node_modules`
