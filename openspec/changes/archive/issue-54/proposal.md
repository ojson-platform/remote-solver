## Problem

The row today knows that a worker is running. It does not know that an action is ready and waiting for a free slot. The closed plaque already has a narrow form. On tasking, once tasks.md exists, it shows `Waits for` the keys of child cycles that are not yet specified. On implementing it shows `Done <done>/<done+open>` from tasks.md. The narrow `Waits for` line is only the child wait at tasking. A blocker, the phase the wait runs until, a worker, a full cap, and checks are not on the plaque yet.

## Outcome

The pager's open page is a live page in four cases. The window computes it from the current decision and from whether a worker is on this issue. It is not an issue comment, it is not a history slot, and it disappears when the reason passes. Past live reasons are not pages.

A worker on this issue: the text is the phase and the action the machine gave the worker.

The next action is ready and did not start because the cap is full: the text is that next action.

The cycle waits on another issue: the text names who and until which phase. A child and a blocker are named the way the decision names them. One number is named once.

Checks are still running, or checks are red and the failure has not been handed to a worker yet: the text says which of those two it is.

The live page is the open page only in those cases, in this order. A worker on this issue wins. Otherwise a ready action that the cap held back. Otherwise a wait on another issue or on checks. Otherwise the latest written page stays open.

This change keeps that count when no live reason applies. In the four cases above, the plaque shows the same live sentence as the open page, and that sentence leaves when the reason passes. The live sentence does not replace an ask. On a review gate the plaque does not take it.

On the review gate for the proposal, the spec, the design, or accepting, the open page stays the written focus of that stop. The ask block stays its own block and is not copied into the live page.

While no written page exists, the live page is the only page and Back does nothing. The badge is its own: working, waiting for a slot, waiting on an issue, or checks. It is not a phase marker.

Opening the sidebar, a worker starting, and a new written comment each return the block to now.

## Scope

The pager's open page is a live page in four cases. The window computes it from the current decision and from whether a worker is on this issue. This change adds the fact that an action is ready and waiting for a free slot. In the four cases the plaque shows the same live sentence as the open page, and that sentence leaves when the reason passes. This change keeps the `Done <done>/<done+open>` count when no live reason applies.

## Out of scope

Which visits write a comment and what that prose says. Linking a scenario name to its row. The Accept row caption. Screenshots and recordings.

## Constraints

The live page is the open page only in those cases, in this order. A worker on this issue wins. Otherwise a ready action that the cap held back. Otherwise a wait on another issue or on checks. Otherwise the latest written page stays open.

It is not an issue comment, it is not a history slot, and it disappears when the reason passes. Past live reasons are not pages.

The live sentence does not replace an ask. On a review gate the plaque does not take it. On the review gate for the proposal, the spec, the design, or accepting, the open page stays the written focus of that stop. The ask block stays its own block and is not copied into the live page.

This change keeps that count when no live reason applies. The narrow `Waits for` line is only the child wait at tasking.

While no written page exists, the live page is the only page and Back does nothing. The badge is its own: working, waiting for a slot, waiting on an issue, or checks. It is not a phase marker.

Opening the sidebar, a worker starting, and a new written comment each return the block to now.

Depends: #53

## Capabilities

### Added

- `live-focus-page` the open page is a live page in four cases, and the closed plaque shows that same sentence until the reason passes

### Modified

## Open questions

none
