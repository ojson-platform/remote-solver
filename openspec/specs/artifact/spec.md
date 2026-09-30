# artifact

## Purpose

Each writing phase owns one change file. The cycle returns to the phase that still has to write it.

## Requirements

### Requirement: A writing phase publishes its own file

`proposing` owns the proposal, `specifying` the delta, `designing` the design, and `tasking` the tasks. While that file is missing, or no pull request is open, the machine SHALL run the skill that writes and publishes it, and SHALL NOT open the review gate.

#### Scenario: Proposing without a proposal writes one

- **WHEN** the phase is `proposing` and the change has no proposal
- **THEN** the machine runs the plan skill and does not set `wait-human`

#### Scenario: A proposal with no pull request is published

- **WHEN** the phase is `proposing`, the proposal exists, and no pull request is open
- **THEN** the machine runs the plan skill to publish it

### Requirement: A missing earlier file returns one phase

`specifying` SHALL return to `proposing` when the proposal is missing. `designing` SHALL return to `specifying` when the delta is missing. `tasking` SHALL return to `designing` when the design is missing. `implementing` SHALL return to `tasking` when the tasks are missing. Each check looks only at that one file.

#### Scenario: Specifying without a proposal returns to proposing

- **WHEN** the phase is `specifying` and the change has no proposal
- **THEN** the machine moves the issue to `proposing`

#### Scenario: Designing with a delta and no proposal stays

- **WHEN** the phase is `designing` and the delta exists
- **THEN** the machine does not move the issue to `proposing` because the proposal is absent

### Requirement: Open items hold only their own file

An unchecked item under Open questions SHALL hold `proposing`, including when `auto-plan` is set. An unchecked item under Open decisions SHALL hold `designing`, including when `auto-design` is set. `specifying` SHALL NOT hold for an unchecked item in the delta.

#### Scenario: Open questions hold proposing under auto-plan

- **WHEN** `proposing` has a published proposal, two open questions, and `auto-plan`
- **THEN** the machine waits and does not move to `specifying`

#### Scenario: An open task stays in implementing

- **WHEN** `implementing` has a tasks file with an unchecked task
- **THEN** the machine runs the next task and does not move to `verifying`
