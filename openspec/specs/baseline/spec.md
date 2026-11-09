# baseline

## Purpose

On `specifying`, a capability the proposal marks Modified is restored before the delta is written or a spec thread is answered.

## Requirements

### Requirement: A Modified id without a baseline is restored first

On `specifying`, each id under Capabilities / Modified that has no `openspec/specs/<id>/spec.md` SHALL be restored before the machine writes a delta or answers a spec thread. An Added id SHALL NOT be restored merely because that file is absent. The id SHALL be the first token of the line with one surrounding pair of backticks and one trailing colon removed, so a line ``- `cache-first`: gist`` names `cache-first`.

#### Scenario: Specifying restores a missing baseline before the delta

- **WHEN** the phase is `specifying`, the proposal exists, and a Modified id has no baseline
- **THEN** the machine restores that baseline and does not write the delta

#### Scenario: A spec thread waits for the missing baseline

- **WHEN** the phase is `specifying`, a spec thread is open, and a Modified id has no baseline
- **THEN** the machine restores the baseline and does not answer the thread

#### Scenario: A fenced Modified id finds its baseline

- **WHEN** the phase is `specifying` and the Modified lines are ``- `cache-first` keep the first hit`` and ``- `board`: stations``, and both baseline files exist
- **THEN** the ids are `cache-first` and `board`, and the machine does not restore a baseline

#### Scenario: A fenced Modified id with no file is restored

- **WHEN** the phase is `specifying` and the only Modified line is ``- `cache-first` keep the first hit``, and that baseline file is absent
- **THEN** the machine restores `cache-first`

### Requirement: An Added shelf is published before the delta

Before a delta file exists, an Added id that `## Shelf` does not list SHALL be restored. The restore publishes the look: a rule this checkout shows moves to Modified and its baseline is written; a rule this checkout does not show stays Added and no baseline is written; every capability id is listed under `## Shelf`. An Added id that `## Shelf` already lists SHALL NOT be restored again. Once a delta file exists, an Added id SHALL NOT be restored for this look. A Modified id with no baseline SHALL still be restored when a delta and a spec thread already exist.

#### Scenario: An unjudged Added id is restored before the delta

- **WHEN** the phase is `specifying`, the proposal names an id only as Added, `## Shelf` does not list it, and no delta file exists
- **THEN** the machine restores that shelf

#### Scenario: A judged Added id is not restored again

- **WHEN** the phase is `specifying`, the id is Added, `## Shelf` lists it, and no baseline file exists
- **THEN** the machine does not restore a baseline for it

#### Scenario: An Added id is not restored once a delta exists

- **WHEN** the phase is `specifying`, a delta file exists, and an Added id is not listed under `## Shelf`
- **THEN** the machine does not restore that shelf
