# finished-cycle

## Purpose

A cycle is finished when its pull request is merged and its change is archived. The machine closes the issue, does not restore that change, and does not start another step. The card leaves the board, and a reload does not bring it back. An archived change whose pull request is still open is restored through `tasking`, and the card stays. From `accepting` the machine closes the issue and the card leaves the open list.

## Requirements

### Requirement: An archived change through tasking is restored

On `proposing`, `specifying`, `designing`, and `tasking`, an archived change SHALL be restored and the machine SHALL start that step. A merged pull request SHALL NOT stop the restore. Tasks that are all checked SHALL NOT stop the restore. The issue SHALL stay open. When the assignee is this manager, the card SHALL stay on the board, and a later reading of the open list SHALL show the card again. On `proposed`, `specified`, and `designed`, an archived change SHALL move the phase and then SHALL be restored. The issue SHALL stay open, and when the assignee is this manager the card SHALL stay on the board.

#### Scenario: Tasking restores a merged archived change

- **WHEN** the phase is `tasking`, the assignee is this manager, the pull request is merged, the change is archived, and every task is checked
- **THEN** the machine restores the change and starts that step, the issue stays open on `tasking`, the card stays on the board, and a later reading of the open list shows the card

#### Scenario: A proposed gate restores after it moves

- **WHEN** the phase is `proposed`, the assignee is this manager, and the change is archived
- **THEN** the machine moves the phase, then restores the change, and the issue stays open

### Requirement: Implementing and verifying keep a merged archived cycle

On `implementing` and `verifying`, a merged pull request and an archived change SHALL leave the issue open. When the assignee is this manager, the card SHALL stay on the board, and a later reading of the open list SHALL show the card. When `implementing` has no tasks, the machine SHALL move the phase to `tasking` and then restore the change. When `implementing` has an open task, the machine SHALL start that task. When `implementing` has every task checked, no child short of `accepted`, and no open blocker, the machine SHALL move the phase to `verifying` and wait because there is no open pull request, and it SHALL NOT restore the change. When the phase is `verifying` and the pull request is merged, the machine SHALL wait because there is no open pull request, and it SHALL NOT restore the change or close the issue.

#### Scenario: Implementing without tasks restores from tasking

- **WHEN** the phase is `implementing`, the pull request is merged, the change is archived, and the tasks are absent
- **THEN** the machine moves the phase to `tasking`, restores the change, and the issue stays open

#### Scenario: An open task starts

- **WHEN** the phase is `implementing`, the pull request is merged, the change is archived, and a task is open
- **THEN** the machine starts that task and the issue stays open

#### Scenario: Checked tasks wait for an open pull request

- **WHEN** the phase is `implementing`, the assignee is this manager, the pull request is merged, the change is archived, every task is checked, and the cycle has no child short of `accepted` and no open blocker
- **THEN** the phase moves to `verifying`, the machine waits because there is no open pull request, the issue stays open, and the card stays on the board

#### Scenario: Verifying waits when the pull request is merged

- **WHEN** the phase is `verifying`, the assignee is this manager, the pull request is merged, and the change is archived
- **THEN** the machine waits because there is no open pull request, the issue stays open, and the card stays on the board

### Requirement: Accepting closes a merged archived cycle

When the phase is `accepting` or `accepted`, the pull request is merged, and the change is archived, the machine SHALL set `accepted` and close the issue. The close comment SHALL say that the pull request is merged and the baseline is in trunk. The machine SHALL NOT restore the change and SHALL NOT start another step. The issue SHALL be absent from the open list. A later reading of the open list SHALL NOT show the card.

#### Scenario: Accepting closes

- **WHEN** the phase is `accepting`, the pull request is merged, and the change is archived
- **THEN** the machine sets `accepted`, closes the issue, does not restore the change, does not start a step, and a later reading of the open list has no card

#### Scenario: Accepted closes

- **WHEN** the phase is `accepted`, the pull request is merged, and the change is archived
- **THEN** the machine closes the issue and a later reading of the open list has no card

### Requirement: An open pull request keeps the card

On a phase before `accepting`, a cycle whose pull request is open SHALL stay on the board when the assignee is this manager, including when every task is checked. The issue SHALL stay open.

#### Scenario: Checked tasks and an open pull request stay

- **WHEN** the phase is `tasking`, the assignee is this manager, the pull request is open, and every task is checked
- **THEN** the issue stays open and the card stays on the board

### Requirement: A closed issue leaves the open list

The board SHALL be filled from the open issues. A closed issue SHALL be absent from that reading, and a later reading SHALL NOT show its card.
When the board places a closed issue, the card SHALL leave when the phase is `accepted` or the merge is ahead. A closed issue on `tasking` SHALL stand on `tasking`. A closed issue on `verifying` SHALL stand on `verifying`. A closed issue on `accepting` SHALL stand on `accepting` unless the merge is ahead.

#### Scenario: A later reading omits a closed issue

- **WHEN** the issue is closed and the board reads the open list again
- **THEN** the card is absent

#### Scenario: A closed tasking issue stands

- **WHEN** a closed issue on `tasking`, assigned to this manager, is in the board's reading
- **THEN** the card stands on `tasking`

#### Scenario: A closed accepted issue leaves

- **WHEN** a closed issue on `accepted` is in the board's reading
- **THEN** the card is absent

#### Scenario: A closed accepting issue leaves only when the merge is ahead

- **WHEN** a closed issue on `accepting` is in the board's reading and the merge is ahead
- **THEN** the card is absent

#### Scenario: A closed accepting issue stands when the merge is not ahead

- **WHEN** a closed issue on `accepting`, assigned to this manager, is in the board's reading and the merge is not ahead
- **THEN** the card stands on `accepting`
