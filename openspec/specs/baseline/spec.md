# baseline

## Purpose

On `specifying`, a capability the proposal marks Modified is restored before the delta is written or a spec thread is answered.

## Requirements

### Requirement: A Modified id without a baseline is restored first

On `specifying`, each id under Capabilities / Modified that has no `openspec/specs/<id>/spec.md` SHALL be restored before the machine writes a delta or answers a spec thread. An id that is not under Modified SHALL NOT be restored for lack of a baseline. The id SHALL be the first token of the line with one surrounding pair of backticks and one trailing colon removed, so a line ``- `cache-first`: gist`` names `cache-first`.

#### Scenario: Specifying restores a missing baseline before the delta

- **WHEN** the phase is `specifying`, the proposal exists, and a Modified id has no baseline
- **THEN** the machine restores that baseline and does not write the delta

#### Scenario: A spec thread waits for the missing baseline

- **WHEN** the phase is `specifying`, a spec thread is open, and a Modified id has no baseline
- **THEN** the machine restores the baseline and does not answer the thread

#### Scenario: An Added id without a baseline does not restore

- **WHEN** the proposal names an id only as Added and that id has no baseline
- **THEN** the machine does not restore a baseline for it

#### Scenario: A fenced Modified id finds its baseline

- **WHEN** the phase is `specifying` and the Modified lines are ``- `cache-first` keep the first hit`` and ``- `board`: stations``, and both baseline files exist
- **THEN** the ids are `cache-first` and `board`, and the machine does not restore a baseline

#### Scenario: A fenced Modified id with no file is restored

- **WHEN** the phase is `specifying` and the only Modified line is ``- `cache-first` keep the first hit``, and that baseline file is absent
- **THEN** the machine restores `cache-first`
