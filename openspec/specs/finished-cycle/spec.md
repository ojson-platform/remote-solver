# finished-cycle

## Purpose

A cycle is finished when its pull request is merged and its change is archived. The machine closes the issue, does not restore that change, and does not start another step. The card leaves the board, and a reload does not bring it back. An archived change whose pull request is still open is restored through `tasking`, and the card stays. From `accepting` the machine closes the issue and the card leaves the open list.

## Requirements

### Requirement: An archived change through tasking is restored

On `proposing`, `specifying`, `designing`, and `tasking`, an archived change whose pull request is still open SHALL be restored and the machine SHALL start that step. Tasks that are all checked SHALL NOT stop the restore. The issue SHALL stay open. When the assignee is this manager, the card SHALL stay on the board, and a later reading of the open list SHALL show the card again. On `proposed`, `specified`, and `designed`, an archived change whose pull request is still open SHALL move the phase and then SHALL be restored. The issue SHALL stay open, and when the assignee is this manager the card SHALL stay on the board.

#### Scenario: An open pull request on tasking is restored

- **WHEN** the phase is `tasking`, the assignee is this manager, the pull request is still open, the change is archived, and every task is checked
- **THEN** the machine restores the change and starts that step, the issue stays open, and the card stays on the board

#### Scenario: A proposed gate restores after it moves

- **WHEN** the phase is `proposed`, the assignee is this manager, the pull request is still open, and the change is archived
- **THEN** the machine moves the phase, then restores the change, and the issue stays open

### Requirement: Accepting closes a merged archived cycle

When the phase is `accepting` or `accepted`, the pull request is merged, and the change is archived, the machine SHALL set `accepted` and close the issue. The close comment SHALL say that the pull request is merged and the baseline is in trunk. The machine SHALL NOT restore the change and SHALL NOT start another step. The issue SHALL be absent from the open list. A later reading of the open list SHALL NOT show the card.

#### Scenario: Accepting closes

- **WHEN** the phase is `accepting`, the pull request is merged, and the change is archived
- **THEN** the machine sets `accepted`, closes the issue, does not restore the change, does not start a step, and a later reading of the open list has no card

#### Scenario: Accepted closes

- **WHEN** the phase is `accepted`, the pull request is merged, and the change is archived
- **THEN** the machine closes the issue and a later reading of the open list has no card

### Requirement: An open pull request keeps the card

On a phase before `accepting`, a cycle whose pull request is open SHALL stay on the board when the assignee is this manager, including when every task is checked and when the change is archived. The issue SHALL stay open.

#### Scenario: Checked tasks and an open pull request stay

- **WHEN** the phase is `tasking`, the assignee is this manager, the pull request is open, and every task is checked
- **THEN** the issue stays open and the card stays on the board

#### Scenario: An open pull request stays on the board when every task is checked

- **WHEN** the phase is `tasking`, the assignee is this manager, the pull request is still open, every task is checked, and the change is archived
- **THEN** the pull request is still open, every task is checked, and the card stays on the board

### Requirement: A closed issue leaves the open list

The board SHALL be filled from the open issues. A closed issue SHALL be absent from that reading, and a later reading SHALL NOT show its card.
When the board places a closed issue, the card SHALL leave when the phase is `accepted` or the merge is ahead. A closed issue on `tasking` SHALL stand on `tasking`. A closed issue on `verifying` SHALL stand on `verifying`. A closed issue on `accepting` SHALL stand on `accepting` unless the merge is ahead.

#### Scenario: A later reading omits a closed issue

- **WHEN** the issue is closed and the board reads the open list again
- **THEN** the card is absent

#### Scenario: A closed tasking issue stands

- **WHEN** a closed issue on `tasking`, assigned to this manager, is in the board's reading
- **THEN** the card stands on `tasking`

#### Scenario: A closed verifying issue stands

- **WHEN** a closed issue on `verifying`, assigned to this manager, is in the board's reading
- **THEN** the card stands on `verifying`

#### Scenario: A closed accepted issue leaves

- **WHEN** a closed issue on `accepted` is in the board's reading
- **THEN** the card is absent

#### Scenario: A closed accepting issue leaves only when the merge is ahead

- **WHEN** a closed issue on `accepting` is in the board's reading and the merge is ahead
- **THEN** the card is absent

#### Scenario: A closed accepting issue stands when the merge is not ahead

- **WHEN** a closed issue on `accepting`, assigned to this manager, is in the board's reading and the merge is not ahead
- **THEN** the card stands on `accepting`

### Requirement: A finished cycle leaves the board

A cycle is finished when its pull request is merged and its change is archived. The machine SHALL close the issue, so the board's open list no longer has the cycle. The machine SHALL NOT restore that change and SHALL NOT start another step on it. The cycle SHALL leave the board, and a reload SHALL NOT bring it back. Tasks that are all checked SHALL NOT keep a finished cycle on the board.

On `implementing`, the machine SHALL NOT move a finished cycle to `tasking` to restore it, SHALL NOT start an open task, and SHALL NOT move it to `verifying` to wait for an open pull request. On `verifying`, the machine SHALL NOT wait because there is no open pull request. On `proposed`, `specified`, and `designed`, the machine SHALL NOT move the phase and then restore the change.

A cycle that carries `sdd:cancelled` SHALL NOT be closed by this requirement.

#### Scenario: A finished cycle leaves the board and a reload does not bring it back

- **WHEN** the phase is `tasking`, the assignee is this manager, the pull request is merged, the change is archived, every task is checked, the card is on the board, and the board is reloaded
- **THEN** the finished cycle has left the board and the reload does not bring it back

#### Scenario: A cycle is finished when its pull request is merged and its change is archived

- **WHEN** the phase is `tasking`, the assignee is this manager, the pull request is merged, the change is archived, and every task is checked
- **THEN** the cycle is finished, the pull request is merged, the change is archived, the issue is closed, and the card has left the board

#### Scenario: The issue closes and the board's open list no longer has it

- **WHEN** the phase is `tasking`, the assignee is this manager, the issue is on the board's open list, the pull request is merged, the change is archived, and every task is checked
- **THEN** the issue is closed and the board's open list no longer has the cycle

#### Scenario: The machine does not restore that change and does not start another step

- **WHEN** the phase is `tasking`, the assignee is this manager, the pull request is merged, the change is archived, every task is checked, and the card is on the board
- **THEN** the machine does not restore that change and does not start another step

#### Scenario: Implementing without tasks does not restore a finished cycle

- **WHEN** the phase is `implementing`, the pull request is merged, the change is archived, and the tasks are absent
- **THEN** the machine does not move the phase to `tasking`, does not restore the change, does not start a step, and the issue is closed

#### Scenario: An open task on a finished cycle does not start

- **WHEN** the phase is `implementing`, the pull request is merged, the change is archived, and a task is open
- **THEN** the machine does not start that task, does not restore the change, and the issue is closed

#### Scenario: Checked tasks on a finished cycle do not wait for an open pull request

- **WHEN** the phase is `implementing`, the assignee is this manager, the pull request is merged, the change is archived, every task is checked, and the cycle has no child short of `accepted` and no open blocker
- **THEN** the machine does not move the phase to `verifying`, does not wait for an open pull request, the issue is closed, and the card has left the board

#### Scenario: A finished cycle on verifying leaves the board and a reload does not bring it back

- **WHEN** the phase is `verifying`, the assignee is this manager, the pull request is merged, the change is archived, and the board is reloaded
- **THEN** the machine does not wait for an open pull request, the issue is closed, the cycle has left the board, and the reload does not bring it back

#### Scenario: A finished cycle on a proposed gate does not restore

- **WHEN** the phase is `proposed`, the assignee is this manager, the pull request is merged, the change is archived, and every task is checked
- **THEN** the machine does not restore the change, does not start a step, the issue is closed, and the card has left the board

### Requirement: A cancelled cycle leaves the board

A cycle that carries `sdd:cancelled` SHALL leave the board as it does now. An earlier phase label SHALL NOT keep the card. A pull request that is still open, and tasks that are all checked, SHALL NOT keep that card.

#### Scenario: A cancelled cycle still leaves as it does now

- **WHEN** an issue carries `sdd:cancelled` and an earlier phase label, the pull request is still open, and every task is checked
- **THEN** the card is absent from the board
