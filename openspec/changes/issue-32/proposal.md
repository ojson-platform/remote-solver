## Problem

Issue #9 is the case. Its pull request #25 is merged, the change sits in `openspec/changes/archive/issue-9/`, and the tasks are 5/5. The issue is still open on `tasking`, and the board still shows the card after a reload.

## Outcome

A finished cycle leaves the board, and a reload does not bring it back.

A cycle is finished when its pull request is merged and its change is archived. The issue closes, so the board's open list no longer has it. The machine does not restore that change and does not start another step on it.

## Scope

A cycle is finished when its pull request is merged and its change is archived. The issue closes, so the board's open list no longer has it. The machine does not restore that change and does not start another step on it. A finished cycle leaves the board, and a reload does not bring it back.

## Out of scope

Deleting the issue. Closing a cycle whose pull request is open. Hiding a single checked task inside the Tasks row.

## Constraints

A cycle whose pull request is still open stays on the board, including one whose tasks are all checked. A cancelled cycle still leaves as it does now.

## Capabilities

### Added

### Modified

- finished-cycle a finished cycle leaves the board, and a reload does not bring it back

## Open questions
