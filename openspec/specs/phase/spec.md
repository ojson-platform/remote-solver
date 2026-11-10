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

#### Scenario: Accepted wins over cancelled on the rank

- **WHEN** an issue carries `accepted` and `cancelled`
- **THEN** the phase is `accepted` and its rank is the rank of `accepted`

- **WHEN** an issue carries `cancelled` and `tasking` and does not carry `accepted`
- **THEN** the rank is cut

### Requirement: A gate label is consent, not a phase

`proposed` closes `proposing`, `specified` closes `specifying`, and `designed` closes `designing`. The gate SHALL NOT replace the writing phase. A lone gate label SHALL still name that writing phase for the decision. Any other pair SHALL keep the earliest label in phase order.

#### Scenario: The writing phase stays when the gate label is also on

- **WHEN** an issue carries `proposing` and `proposed`
- **THEN** the phase is `proposing`

#### Scenario: A lone gate label is the writing phase it closes

- **WHEN** an issue carries only `proposed`
- **THEN** the phase is `proposing`

#### Scenario: Otherwise the earliest label wins

- **WHEN** an issue carries `proposing` and `specified`
- **THEN** the phase is `proposing`

### Requirement: The machine does not set a gate label

`set` SHALL refuse `proposed`, `specified`, `designed`, and `accepted`. A person sets those on the issue.

#### Scenario: Set refuses a gate label

- **WHEN** `set` is asked to put `proposed` on an issue
- **THEN** the command fails and the labels stay as they were

### Requirement: The decision reads one cycle record

Before a decision, the labels, the hold, and the tip's `Sdd-Archive` line SHALL collapse into one phase, one hold, and one folded bit. The decision SHALL use that record. An archive directory without that line SHALL NOT count as folded. A tip line without the archive directory SHALL count as folded. `sdd accept` SHALL use that same record.

#### Scenario: A gate label and the phase it closes are one phase before the decision

- **WHEN** the record is built from `proposing` and `proposed`, and the issue passed to the decision carries only `proposing`
- **THEN** the decision moves to `specifying`

#### Scenario: An archive directory without the tip line is not folded

- **WHEN** the change directory is archived and the tip message has no `Sdd-Archive` line
- **THEN** the decision does not restore the change

#### Scenario: A tip line without the archive directory is folded

- **WHEN** the change directory is not archived and the tip message carries `Sdd-Archive` for the issue
- **THEN** the decision restores the change

#### Scenario: Accept uses the same record

- **WHEN** the record is built from `designing` and `designed`, and accept is given an issue that carries only `proposing`
- **THEN** accept moves to `tasking`
