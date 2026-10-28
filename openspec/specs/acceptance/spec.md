# acceptance

## Purpose

The open row accepts Plan, Specify, and Design in the place of the current gate. Specify is offered when the specs are ready.

## Requirements

### Requirement: The current phase offers acceptance in place of its gate

The Plan row SHALL offer acceptance in the gate's place when the plaque is `proposing`, the proposal is present, no question is open, and one pull request is open. When Open questions has an open item, the Plan row SHALL show neither acceptance nor the proposing gate. The acceptance control SHALL use the plaque's 8px radius, a 12px label, and padding of 4px 10px. That row SHALL NOT show its gate. The Design row SHALL offer acceptance the same way for `designing` when no decision is open. The Specify row SHALL offer acceptance when the plaque is `specifying`, one pull request is open, and the specs are ready, and SHALL NOT show the specifying gate. The specs are ready when the change has a delta file, or when the proposal names no capability under Added or Modified. A baseline spec under `openspec/specs/` SHALL NOT by itself make the specs ready. A missing baseline for a Modified capability SHALL NOT offer acceptance. While this cycle's action is `restore-baseline`, `create-initial-specs`, or `improve-specs`, the row SHALL NOT offer acceptance and SHALL NOT show the specifying gate. When the row does not offer acceptance, that place SHALL be empty.

#### Scenario: The current phase shows acceptance instead of its gate

- **WHEN** the plaque is `proposing`, the proposal has no open question, one pull request is open, and the cycle is open
- **THEN** the Plan row shows acceptance where the gate stood, that control has the plaque's 8px radius, a 12px label, and padding of 4px 10px, the row does not show the proposing gate, and the designing line still has its gate

#### Scenario: An open question leaves the current gate's place empty

- **WHEN** the plaque is `proposing`, Open questions has an open item, one pull request is open, and the cycle is open
- **THEN** the Plan row shows neither acceptance nor the proposing gate

#### Scenario: An empty delta offers acceptance

- **WHEN** the plaque is `specifying`, the change has a delta file with no requirement, one pull request is open, and the cycle is open
- **THEN** the Specify row shows acceptance and does not show the specifying gate

#### Scenario: A spec turn hides acceptance

- **WHEN** the plaque is `specifying`, the change has a delta requirement, one pull request is open, the cycle is open, and the action is `restore-baseline`, `create-initial-specs`, or `improve-specs`
- **THEN** the Specify row shows neither acceptance nor the specifying gate

#### Scenario: A proposal with no capability offers acceptance

- **WHEN** the plaque is `specifying`, the proposal names no capability, the change has no delta file, one pull request is open, and the cycle is open
- **THEN** the Specify row shows acceptance and does not show the specifying gate

#### Scenario: A named capability without a delta leaves the place empty

- **WHEN** the plaque is `specifying`, the proposal names a capability, a baseline spec has a requirement, the change has no delta file, one pull request is open, and the cycle is open
- **THEN** the Specify row shows neither acceptance nor the specifying gate

#### Scenario: A missing baseline leaves the place empty

- **WHEN** the plaque is `specifying`, the proposal names a Modified capability whose baseline is absent, the change delta has a requirement, one pull request is open, and the cycle is open
- **THEN** the Specify row shows neither acceptance nor the specifying gate

### Requirement: Accepting a writing phase adds its label

Accepting the plan SHALL add `sdd:proposed` and SHALL leave `sdd:proposing`. Accepting the design SHALL add `sdd:designed` and SHALL leave `sdd:designing`. Accepting the spec SHALL add `sdd:specified` and SHALL leave `sdd:specifying`. Acceptance SHALL NOT write the next phase.

#### Scenario: Accepting the plan adds proposed

- **WHEN** the plaque is `proposing`, the proposal has no open question, one pull request is open, and the manager accepts the plan
- **THEN** the issue gains `sdd:proposed`, keeps `sdd:proposing`, and the window does not write the next phase. The page does not show `Принято` between the header and the board

#### Scenario: Accepting the spec adds specified

- **WHEN** the plaque is `specifying`, the change has a delta requirement, one pull request is open, and the manager accepts the spec
- **THEN** the issue gains `sdd:specified` and keeps `sdd:specifying`

#### Scenario: Accepting the design adds designed

- **WHEN** the plaque is `designing`, the design has no open decision, one pull request is open, and the manager accepts the design
- **THEN** the issue gains `sdd:designed` and keeps `sdd:designing`
