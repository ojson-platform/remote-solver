# written-focus-page

## Purpose

The focus block pages the written focus comments and opens on the latest, in full. The marker is the badge. The prose sits under it. The block sits in the scrolling body, directly under the title and above the reason and the ask. Each spine row keeps the first sentence of the latest written focus of that phase.

## Requirements

### Requirement: The focus block shows the latest written focus

The focus block SHALL page the written focus comments.

A written focus comment SHALL be a focus comment that is not a manager comment, and a comment whose first line is `sdd:focus:accept` SHALL be one of those pages.

Opening the sidebar SHALL land on now: the latest written focus, in full.

Back SHALL walk the older written comments, newest first, each in full.

Forward SHALL return toward now.

Switching tickets SHALL land on now for that ticket.

#### Scenario: The focus block pages the written focus comments

While an older page is open and a new focus comment appears, the block SHALL return to now.

The badge SHALL be that comment's marker.

The prose under the badge SHALL be the comment after the marker line.

When the marker is `sdd:focus`, a line whose first word is Change, Plan, Specify, Design, Tasks, or Code SHALL stay in that prose, and the other lines SHALL remain.

When the marker is `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, `sdd:focus:code`, or `sdd:focus:accept`, the prose SHALL be the comment after the marker as written.

When the issue has no focus comment, the block SHALL be absent.

- **WHEN** the focus block and the written focus comments are already visible, and the focus block already pages those comments, together with a single latest comment and no other page as the limit that can replace those pages
- **THEN** the focus block pages the written focus comments

#### Scenario: Opening the sidebar lands on now: the latest written focus, in full

- **WHEN** the sidebar, now, and the latest written focus are already visible, and opening the sidebar already lands on now, the latest written focus, in full, together with an older written focus as the limit that can replace that latest
- **THEN** opening the sidebar lands on now: the latest written focus, in full

#### Scenario: Back walks the older written comments, newest first, each in full

- **WHEN** Back and the older written comments are already visible, and Back already walks those comments, newest first, each in full, together with oldest first as the limit that can replace that order
- **THEN** Back walks the older written comments, newest first, each in full

#### Scenario: Forward returns toward now

- **WHEN** Forward and now are already visible, and Forward already returns toward now, together with an older written comment as the limit that can replace now
- **THEN** Forward returns toward now

#### Scenario: Switching tickets lands on now for that ticket

- **WHEN** the tickets and now are already visible, and switching tickets already lands on now for that ticket, together with the page open on the previous ticket as the limit that can replace that now
- **THEN** switching tickets lands on now for that ticket

#### Scenario: While an older page is open and a new focus comment appears, the block returns to now

- **WHEN** an older page, a new focus comment, the block, and now are already visible, and the block already returns to now, together with staying on that older page as the limit that can replace now
- **THEN** while an older page is open and a new focus comment appears, the block returns to now

#### Scenario: The badge is the comment's marker

- **WHEN** the badge and the comment's marker are already visible, and the badge is already the comment's marker, together with the prose as the limit that can replace that marker
- **THEN** the badge is the comment's marker

#### Scenario: sdd:focus:accept is one of these pages

- **WHEN** `sdd:focus:accept` and these pages are already visible, and `sdd:focus:accept` is already one of these pages, together with leaving that comment out of the pages as the limit that can replace that
- **THEN** `sdd:focus:accept` is one of these pages

#### Scenario: An unmarked focus record is one of these pages

- **WHEN** a comment's first line is `sdd:focus:code`, the robot mark is absent, and the comment is not a manager comment
- **THEN** that comment is a written page

#### Scenario: A manager comment is not the block

- **WHEN** the last comment is a manager comment that begins with `sdd:focus`, and an earlier comment begins with `sdd:focus:code`
- **THEN** opening the sidebar lands on the earlier comment, the badge is `sdd:focus:code`, and the prose is that comment after the marker

#### Scenario: A whole-pull-request comment keeps a following Plan line in the prose

- **WHEN** the page is a comment that begins with `sdd:focus`, the next line begins with Plan, and the line after that names no phase, together with leaving that Plan line out of the prose as the limit that can replace keeping it
- **THEN** the badge is `sdd:focus` and the prose is the Plan line and the line that names no phase

#### Scenario: A phase comment keeps the prose after the marker

- **WHEN** the page is a comment that begins with `sdd:focus:plan` and the following lines are two sentences
- **THEN** the badge is `sdd:focus:plan` and the prose is both sentences

#### Scenario: An accept comment keeps the prose after the marker

- **WHEN** the page is a comment that begins with `sdd:focus:accept` and the following lines are two sentences
- **THEN** the badge is `sdd:focus:accept` and the prose is both sentences

#### Scenario: No focus comment leaves no block

- **WHEN** the open ticket has no focus comment
- **THEN** the sidebar has no focus block

#### Scenario: Another ticket shows its own latest focus

- **WHEN** one ticket's latest focus comment begins with `sdd:focus:plan` and another ticket's begins with `sdd:focus:code`, and the sidebar opens the second ticket
- **THEN** the focus block's badge is `sdd:focus:code` and the prose is that comment in full
### Requirement: The focus block sits in the scrolling body

The title and the chips SHALL sit in the sidebar header. The focus block SHALL sit in the scrolling body, directly under the title. The chips SHALL stay in the header and SHALL NOT scroll with the block. The open row SHALL NOT show a reason block, an ask block, or a review title. A hook SHALL stay its own block under the pager.

#### Scenario: The focus block sits directly under the title

- **WHEN** the focus block and the title are already visible, and the focus block already sits directly under the title, together with a reason block or an ask block above it as the limit that can replace that place
- **THEN** the focus block sits directly under the title and the open row has no reason block and no ask block

#### Scenario: Chips stay in the header and do not scroll with the block

- **WHEN** the chips, the header, and the block are already visible, and the chips already stay in the header and do not scroll with the block, together with the chips scrolling with the block as the limit that can replace that
- **THEN** chips stay in the header and do not scroll with the block

#### Scenario: A hook stays under the pager and the reason, the ask, and a review title do not

- **WHEN** a hook and the pager are already visible, and a reason, an ask, and an unmarked review are not titled blocks under the pager
- **THEN** the hook stays its own block under the pager, and the open row has no reason title, no ask title, and no review title
### Requirement: Each spine row keeps the first sentence of the latest written focus of that phase

Each spine row SHALL keep the first sentence of the latest written focus of that phase.

#### Scenario: Each spine row keeps the first sentence of the latest written focus of that phase

- **WHEN** each spine row, the first sentence, and the latest written focus of that phase are already visible, and the row already keeps that first sentence, together with the whole written focus as the limit that can replace that first sentence
- **THEN** each spine row keeps the first sentence of the latest written focus of that phase
