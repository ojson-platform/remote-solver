# baseline

## Purpose

On `specifying`, a capability the proposal marks Modified is restored before the delta is written or a spec thread is answered.

## Requirements

### Requirement: A Modified id without a baseline is restored first

On `specifying`, each id under Capabilities / Modified that has no `openspec/specs/<id>/spec.md` SHALL be restored before the machine writes a delta or answers a spec thread. An id that is not under Modified SHALL NOT be restored for lack of a baseline.

#### Scenario: Specifying restores a missing baseline before the delta

- **WHEN** the phase is `specifying`, the proposal exists, and a Modified id has no baseline
- **THEN** the machine restores that baseline and does not write the delta

#### Scenario: A spec thread waits for the missing baseline

- **WHEN** the phase is `specifying`, a spec thread is open, and a Modified id has no baseline
- **THEN** the machine restores the baseline and does not answer the thread

#### Scenario: An Added id without a baseline does not restore

- **WHEN** the proposal names an id only as Added and that id has no baseline
- **THEN** the machine does not restore a baseline for it
