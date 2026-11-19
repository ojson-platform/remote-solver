# task-chip

## Purpose

Tasks names the first open task of an implementing cycle with the badge `impl`. A done task shows `готово`. An open task shows `открыто`.

## Requirements

### Requirement: The Tasks row marks the first open task of an implementing cycle

On a cycle in `implementing`, the Tasks row SHALL show the id of the first open task and the badge `impl` beside that id.

The first open task is the earliest task that is not done. A done task ahead of it SHALL NOT take that badge. A later open task SHALL NOT take that badge.

When the cycle has no open task, the Tasks row SHALL show no `impl` badge.

A cycle that is not in `implementing` SHALL show no `impl` badge.

#### Scenario: The first open task shows impl

- **WHEN** a cycle is in `implementing`, the first task is done, and the next two tasks are open
- **THEN** the Tasks row shows the badge `impl` beside the second task's id and beside no other task

#### Scenario: A cycle with no open task shows no impl

- **WHEN** a cycle is in `implementing` and it has no open task
- **THEN** the Tasks row shows no `impl` badge

#### Scenario: A cycle outside implementing shows no impl

- **WHEN** a cycle is not in `implementing` and it has an open task
- **THEN** the Tasks row shows no `impl` badge

### Requirement: A done task shows готово and an open task shows открыто

A done task SHALL show `готово`. An open task SHALL show `открыто`.

A cycle that is not in `implementing` SHALL keep those words.

The first open task of a cycle in `implementing` SHALL show `открыто` on its own mark while the Tasks row shows `impl` beside that same id.

#### Scenario: A done task shows готово

- **WHEN** a task is done
- **THEN** that task shows `готово`

#### Scenario: An open task shows открыто

- **WHEN** a task is open
- **THEN** that task shows `открыто`

#### Scenario: The task marked impl still shows открыто

- **WHEN** a cycle is in `implementing` and the Tasks row shows `impl` beside the first open task
- **THEN** that task shows `открыто` on its own mark

#### Scenario: A cycle outside implementing keeps готово and открыто

- **WHEN** a cycle is not in `implementing`, one task is done, and another is open
- **THEN** the done task shows `готово` and the open task shows `открыто`
