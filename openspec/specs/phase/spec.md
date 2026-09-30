# phase

## Purpose

One label names where a cycle is. The machine reads that label before it does anything else.

## Requirements

### Requirement: A cycle with no phase enters proposing

An open cycle that is not cancelled and carries no phase label SHALL move to `proposing`.

#### Scenario: The cycle label alone enters proposing

- **WHEN** an open issue carries the cycle label and no phase label
- **THEN** the machine sets `proposing`

### Requirement: Cancelled ends the cycle

An issue that carries `cancelled` SHALL be done. The machine SHALL NOT move it, even when a phase label is still on.

#### Scenario: Cancelled with a phase label is done

- **WHEN** an issue carries `cancelled` and `proposing`
- **THEN** the machine does not change the phase

### Requirement: Accepted wins over every other phase label

When `accepted` is on the issue, the phase SHALL be `accepted`, even when an earlier phase label is still on.

#### Scenario: Accepted wins over accepting

- **WHEN** an issue carries `accepting` and `accepted`
- **THEN** the phase is `accepted`

### Requirement: A gate label wins only over the phase it closes

`proposed` closes `proposing`, `specified` closes `specifying`, and `designed` closes `designing`. When both are on, the gate SHALL be the phase. Any other pair SHALL keep the earliest label in phase order.

#### Scenario: The gate wins over the phase it closes

- **WHEN** an issue carries `proposing` and `proposed`
- **THEN** the phase is `proposed`

#### Scenario: Otherwise the earliest label wins

- **WHEN** an issue carries `proposing` and `specified`
- **THEN** the phase is `proposing`

### Requirement: The machine does not set a gate label

`set` SHALL refuse `proposed`, `specified`, `designed`, and `accepted`. A person sets those on the issue.

#### Scenario: Set refuses a gate label

- **WHEN** `set` is asked to put `proposed` on an issue
- **THEN** the command fails and the labels stay as they were
