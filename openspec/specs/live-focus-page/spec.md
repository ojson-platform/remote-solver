# live-focus-page

## Purpose

The pager's open page is a live page in four cases, and the closed plaque shows that same sentence until the reason passes.

## Requirements

### Requirement: The open page is a live page in four cases

The pager's open page SHALL be a live page in four cases. The window SHALL compute that page from the current decision and from whether a worker is on this issue. The live page SHALL NOT be an issue comment and SHALL NOT be a history slot. It SHALL disappear when the reason passes. Past live reasons SHALL NOT be pages.

#### Scenario: The pager's open page is a live page in four cases

- **WHEN** the pager's open page is already a live page in the four cases, a worker on this issue, a ready action the cap held back, a wait on another issue, and checks, together with the latest written page as the limit that can replace that live page
- **THEN** the pager's open page is a live page in four cases

#### Scenario: The window computes it from the current decision and from whether a worker is on this issue

- **WHEN** the current decision and whether a worker is on this issue are already visible, and the window already computes the live page from those, together with an issue comment as the limit that can replace that decision and that worker
- **THEN** the window computes the live page from the current decision and from whether a worker is on this issue

#### Scenario: It is not an issue comment, it is not a history slot, and it disappears when the reason passes

- **WHEN** the live page is already not an issue comment and already not a history slot, and it already disappears when the reason passes, together with that page remaining as a history slot after the reason passes as the limit that can replace that disappearance
- **THEN** it is not an issue comment, it is not a history slot, and it disappears when the reason passes

#### Scenario: Past live reasons are not pages

- **WHEN** past live reasons are already not pages, together with a past live reason as a page Back can open as the limit that can replace that
- **THEN** past live reasons are not pages

### Requirement: The live text is the case that holds

A worker on this issue SHALL make the text the phase and the action the machine gave the worker.

The next action that is ready and did not start because the cap is full SHALL make the text that next action.

When the cycle waits on another issue, the text SHALL name who and the phase the wait runs until.

A child SHALL be named the way the decision names that child.

A blocker SHALL be named the way the decision names that blocker.

One number SHALL be named once.

#### Scenario: A worker on this issue shows the phase and the action

When checks are still running, the text SHALL say checks are still running.

When checks are red and the failure has not been handed to a worker yet, the text SHALL say checks are red and the failure has not been handed to a worker yet.

- **WHEN** a worker is already on this issue, the phase is already `specifying`, the action the machine gave the worker is already `create-initial-specs`, and the text is already that phase and that action, together with the next action `create-design` that the cap held back as the limit that can replace that phase and that action
- **THEN** the text is `specifying` and `create-initial-specs`

#### Scenario: A full cap shows the next action

- **WHEN** the next action `create-design` is already ready and did not start because the cap is full, and the text is already `create-design`, together with a worker on this issue as the limit that can replace that next action
- **THEN** the text is `create-design`

#### Scenario: A wait on another issue names who and until which phase

- **WHEN** the cycle already waits on another issue, the decision already names child `12` and the wait already runs until `specified`, and the text already names `12` and `specified`, together with a name the decision does not use as the limit that can replace `12`
- **THEN** the text names `12` and `specified`

#### Scenario: An implementing child is named until accepted

- **WHEN** the decision already names child `12` and the wait already runs until `accepted`, and the text already names `12` and `accepted`, together with `specified` as the limit that can replace `accepted`
- **THEN** the text names `12` and `accepted`

#### Scenario: A child and a blocker are named the way the decision names them

- **WHEN** the decision already names child `12` and blocker `7`, and the text already names `12` and `7` that same way, together with a different name for each as the limit that can replace those names
- **THEN** a child and a blocker are named the way the decision names them

#### Scenario: One number is named once

- **WHEN** `12` is already both the child and the blocker, the decision already names `12` once, and the text already names `12` once and the phase the wait runs until, together with naming `12` a second time as the limit that can replace naming that number once
- **THEN** one number is named once

#### Scenario: Checks still running

- **WHEN** checks are already still running, and the text already says checks are still running, together with checks that are red and whose failure has not been handed to a worker yet as the limit that can replace that text
- **THEN** the text says checks are still running

#### Scenario: Checks are red and the failure has not been handed to a worker yet

- **WHEN** checks are already red and the failure has not been handed to a worker yet, and the text already says that, together with checks that are still running as the limit that can replace that text
- **THEN** the text says checks are red and the failure has not been handed to a worker yet

### Requirement: The live page is the open page only in that order

Outside the review gate for the proposal, the spec, the design, or accepting, the live page SHALL be the open page only in those four cases, in this order. A worker on this issue SHALL win. Otherwise a ready action that the cap held back SHALL be the open page. Otherwise a wait on another issue, or checks, SHALL be the open page. Otherwise the latest written page SHALL stay open.

#### Scenario: A worker on this issue wins

- **WHEN** a worker is already on this issue, the phase is already `specifying`, the action is already `create-initial-specs`, a ready action `create-design` is already held because the cap is full, the cycle already waits on `12` until `specified`, checks are already still running, and the latest written page is already visible, together with that ready action, that wait, those checks, or that written page as the limit that can replace the worker
- **THEN** the open page is the live page, and the text is `specifying` and `create-initial-specs`

#### Scenario: A ready action that the cap held back is the open page

- **WHEN** no worker is on this issue, the next action `create-design` is already ready and did not start because the cap is full, the cycle already waits on `12` until `specified`, checks are already still running, and the latest written page is already visible, together with that wait, those checks, or that written page as the limit that can replace `create-design`
- **THEN** the open page is the live page and the text is `create-design`

#### Scenario: A wait on another issue is the open page

- **WHEN** no worker is on this issue, no ready action is held by the cap, the cycle already waits on `12` until `specified`, checks are not the live case, and the latest written page is already visible, together with that written page as the limit that can replace the wait
- **THEN** the open page is the live page and the text names `12` and `specified`

#### Scenario: Checks are the open page

- **WHEN** no worker is on this issue, no ready action is held by the cap, the cycle does not wait on another issue, checks are already still running, and the latest written page is already visible, together with that written page as the limit that can replace those checks
- **THEN** the open page is the live page and the text says checks are still running

#### Scenario: The latest written page stays open

- **WHEN** no worker is on this issue, no ready action is held by the cap, the cycle does not wait on another issue, checks are not the live case, and the latest written page is already the open page, together with a past live reason as the limit that can replace that written page
- **THEN** the latest written page stays open

### Requirement: A review gate keeps the written focus and the ask

On the review gate for the proposal, the spec, the design, or accepting, the open page SHALL stay the written focus of that stop. The ask block SHALL stay its own block and SHALL NOT be copied into the live page. The live sentence SHALL NOT replace an ask. On a review gate the plaque SHALL NOT take the live sentence.

#### Scenario: On the review gate for the proposal, the spec, the design, or accepting, the open page stays the written focus of that stop

- **WHEN** the review gate for the proposal, the spec, the design, or accepting is already on, and the open page already stays the written focus of that stop, together with the live page as the limit that can replace that written focus
- **THEN** on the review gate for the proposal, the spec, the design, or accepting, the open page stays the written focus of that stop

#### Scenario: Accepting keeps the written focus while checks are still running

- **WHEN** the review gate for accepting is already on, checks are already still running, and the open page already stays the written focus of that stop, together with the checks live page as the limit that can replace that written focus
- **THEN** the open page stays the written focus of the accepting stop

#### Scenario: The proposal gate keeps the written focus of that stop

- **WHEN** the review gate for the proposal is already on and the open page already stays the written focus of that stop, together with a ready action the cap held back as the limit that can replace that written focus
- **THEN** the open page stays the written focus of the proposal stop

#### Scenario: The spec gate keeps the written focus of that stop

- **WHEN** the review gate for the spec is already on and the open page already stays the written focus of that stop, together with a wait on another issue as the limit that can replace that written focus
- **THEN** the open page stays the written focus of the spec stop

#### Scenario: The design gate keeps the written focus of that stop

- **WHEN** the review gate for the design is already on and the open page already stays the written focus of that stop, together with a worker on this issue as the limit that can replace that written focus
- **THEN** the open page stays the written focus of the design stop

#### Scenario: The ask block stays its own block and is not copied into the live page

- **WHEN** the ask block is already its own block and is already not copied into the live page, together with the ask copied into the live page as the limit that can replace that block
- **THEN** the ask block stays its own block and is not copied into the live page

#### Scenario: The live sentence does not replace an ask

- **WHEN** an ask is already its own block and the live sentence is already showing, together with the live sentence in the ask's place as the limit that can replace that ask
- **THEN** the live sentence does not replace an ask

#### Scenario: On a review gate the plaque does not take the live sentence

- **WHEN** a review gate is already on, a live reason already holds, and the plaque already does not show the live sentence, together with the plaque showing that sentence as the limit that can replace that
- **THEN** on a review gate the plaque does not take the live sentence

### Requirement: The closed plaque shows the live sentence until the reason passes

In the four cases, when a review gate is not on, the plaque SHALL show the same live sentence as the open page. That sentence SHALL leave when the reason passes. When no live reason applies, the plaque SHALL keep `Done <done>/<done+open>` from tasks.md. The narrow `Waits for` line SHALL be only the child wait at tasking, the keys of child cycles that are not yet specified, once tasks.md exists. That line SHALL NOT name a blocker, the phase the wait runs until, a worker, a full cap, or checks.

#### Scenario: The plaque shows the same live sentence as the open page

- **WHEN** one of the four cases already holds, a review gate is not on, and the plaque already shows the same live sentence as the open page, together with `Done <done>/<done+open>` as the limit that can replace that sentence
- **THEN** the plaque shows the same live sentence as the open page

#### Scenario: That sentence leaves when the reason passes

- **WHEN** the reason has already passed and the live sentence has already left the plaque and the open page, together with that sentence staying as the limit that can replace that leaving
- **THEN** that sentence leaves when the reason passes

#### Scenario: The Done count stays when no live reason applies

- **WHEN** no live reason applies, the phase is `implementing`, tasks.md already has one done item and three open items, and the plaque already shows `Done 1/4`, together with a live sentence as the limit that can replace that count
- **THEN** the plaque shows `Done 1/4`

#### Scenario: The narrow Waits for line is only the child wait at tasking

- **WHEN** the phase is `tasking`, tasks.md already exists, child `12` is not yet specified, and the plaque already shows `Waits for 12`, together with blocker `7`, the phase the wait runs until, a worker, a full cap, and checks as the limit that can replace that line
- **THEN** the narrow `Waits for` line is `Waits for 12` and does not name `7`, the phase the wait runs until, a worker, a full cap, or checks

### Requirement: No written page leaves the live page as the only page

While no written page exists, the live page SHALL be the only page and Back SHALL do nothing.

#### Scenario: While no written page exists, the live page is the only page and Back does nothing

- **WHEN** no written page exists, the live page is already the only page, and Back already does nothing, together with a written page as the limit that can replace that only page and give Back a page to open
- **THEN** the live page is the only page and Back does nothing

### Requirement: The live badge is not a phase marker

The live page's badge SHALL be its own: `working` when a worker is on this issue, `waiting for a slot` when a ready action is held by the cap, `waiting on an issue` when the cycle waits on another issue, or `checks` when checks are the live case. The badge SHALL NOT be a phase marker.

#### Scenario: The badge is working

- **WHEN** a worker is already on this issue and the badge is already `working`, together with the phase marker `sdd:focus:spec` as the limit that can replace that badge
- **THEN** the badge is `working` and it is not a phase marker

#### Scenario: The badge is waiting for a slot

- **WHEN** a ready action is already held by the cap and the badge is already `waiting for a slot`, together with the phase marker `sdd:focus:spec` as the limit that can replace that badge
- **THEN** the badge is `waiting for a slot` and it is not a phase marker

#### Scenario: The badge is waiting on an issue

- **WHEN** the cycle already waits on another issue and the badge is already `waiting on an issue`, together with the phase marker `sdd:focus:spec` as the limit that can replace that badge
- **THEN** the badge is `waiting on an issue` and it is not a phase marker

#### Scenario: The badge is checks

- **WHEN** checks are already the live case and the badge is already `checks`, together with the phase marker `sdd:focus:spec` as the limit that can replace that badge
- **THEN** the badge is `checks` and it is not a phase marker

### Requirement: Opening the sidebar, a worker starting, and a new written comment return the block to now

Opening the sidebar, a worker starting, and a new written comment SHALL each return the block to now. While one of the four cases holds and a review gate does not, now SHALL be the live page. Otherwise now SHALL be the latest written page.

#### Scenario: Opening the sidebar returns the block to now

- **WHEN** an older written page is already open, one of the four cases already holds, a review gate does not, and opening the sidebar already returns the block to the live page, together with staying on that older page as the limit that can replace now
- **THEN** opening the sidebar returns the block to now

#### Scenario: A worker starting returns the block to now

- **WHEN** an older written page is already open, a worker is already starting, the phase is already `specifying`, the action is already `create-initial-specs`, and the block already returns to the live page, together with staying on that older page as the limit that can replace now
- **THEN** a worker starting returns the block to now, and the text is `specifying` and `create-initial-specs`

#### Scenario: A new written comment returns the block to now

- **WHEN** an older written page is already open, a new written comment is already visible, one of the four cases already holds, a review gate does not, and the block already returns to the live page, together with that new written comment as the limit that can replace now
- **THEN** a new written comment returns the block to now
