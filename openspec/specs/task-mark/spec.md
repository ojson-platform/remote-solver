# task-mark

## Purpose

In Tasks, each listed task wears `готово` or `открыто`. While the cycle is in `implementing` and a task is open, the Tasks row shows the first open task's id and the badge `impl`. On that task the list and the row disagree.

## Requirements

### Requirement: A listed task wears готово or открыто

Each task listed in Tasks SHALL wear `готово` when that task is done and `открыто` when it is open. The first open task SHALL wear `открыто` in that list, as any later open task does. No listed task SHALL wear `impl`. These words SHALL be the same while the cycle is in `implementing` and while it is not.

#### Scenario: A done task wears готово

- **WHEN** Tasks lists a done task
- **THEN** that task wears `готово` and does not wear `открыто` or `impl`

#### Scenario: An open task wears открыто

- **WHEN** the cycle is in `tasking` and Tasks lists an open task
- **THEN** that task wears `открыто` and does not wear `готово` or `impl`

#### Scenario: The first open task wears открыто in the list during implementing

- **WHEN** the cycle is in `implementing` and Tasks lists an open task, then a done task, then another open task
- **THEN** the first open task wears `открыто`, the done task wears `готово`, the later open task wears `открыто`, and no listed task wears `impl`

### Requirement: The Tasks row shows impl beside the first open task during implementing

While the cycle is in `implementing` and a task is open, the Tasks row SHALL show the id of the earliest open task in the list and the badge `impl`. A later open task SHALL NOT add another `impl` badge on that row. When the cycle is not in `implementing`, the Tasks row SHALL show no `impl` badge. When the cycle is in `implementing` and every listed task is done, or Tasks lists no task, the Tasks row SHALL show no `impl` badge.

#### Scenario: Implementing shows impl beside the first open task

- **WHEN** the cycle is in `implementing` and Tasks lists an open task, then a done task, then another open task
- **THEN** the Tasks row shows the first open task's id and the badge `impl`, and does not show `impl` for the later open task

#### Scenario: A cycle outside implementing has no impl badge

- **WHEN** the cycle is in `tasking` and Tasks lists an open task
- **THEN** the Tasks row shows no `impl` badge

#### Scenario: Implementing with every task done has no impl badge

- **WHEN** the cycle is in `implementing` and every listed task is done
- **THEN** each listed task wears `готово` and the Tasks row shows no `impl` badge

#### Scenario: Implementing with no task has no impl badge

- **WHEN** the cycle is in `implementing` and Tasks lists no task
- **THEN** the Tasks row shows no `impl` badge
