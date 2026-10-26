# spec-diff

## Purpose

Specify shows the baseline spec beside the spec after the delta is applied. A line comment becomes a review thread when the line belongs to the change file.

## Requirements

### Requirement: A capability carries one badge

The collapsed capability summary SHALL show `new` when the baseline text is empty and the folded text is not, `removed` when the folded text is empty and the baseline is not, and `changed` when both texts are non-empty and differ. Equal texts SHALL show no badge. The Specify spine row SHALL NOT show this badge.

#### Scenario: A modified requirement is changed

- **WHEN** the baseline has a requirement and the delta replaces that requirement with different text
- **THEN** the capability summary shows `changed`

#### Scenario: A spec with no baseline is new

- **WHEN** the baseline file is absent and the delta adds a requirement
- **THEN** the capability summary shows `new` and every diff row is an addition

#### Scenario: An empty fold is removed

- **WHEN** the baseline has text and the folded spec is empty
- **THEN** the capability summary shows `removed` and the rows are the baseline as deletions

#### Scenario: The same text has no badge

- **WHEN** the baseline and the folded spec are the same text
- **THEN** the capability summary has no badge and the rows have no additions and no deletions

### Requirement: The drawer shows the folded spec

The drawer SHALL show a unified diff of the baseline against the folded spec. A row SHALL show the baseline line number on the left and the folded line number on the right. A changed word inside a one-line replacement SHALL be marked. A run of more than six unchanged lines between changes SHALL be one gap row whose hidden rows are in the snapshot. More than three unchanged lines before the first change, or after the last change, SHALL be a gap that keeps the three lines next to the change. When a changed line lies in a scenario, the drawer SHALL show that requirement's heading and that scenario's heading, and the lines between those headings SHALL be one gap. Context beside that change SHALL NOT include a line from an earlier scenario. The section headings of the delta SHALL NOT appear in the rows.

#### Scenario: A changed line shows both numbers and the changed words

- **WHEN** one line of a requirement is replaced by one line
- **THEN** the deletion shows the baseline line number, the addition shows the folded line number, and the changed words are marked

#### Scenario: Unchanged lines between hunks sit in the gap

- **WHEN** two changes have ten unchanged lines between them
- **THEN** the snapshot has one gap whose hidden rows are the middle four lines

#### Scenario: Lines before the first change sit in a gap

- **WHEN** eight unchanged lines stand before the first change
- **THEN** one gap hides the first five lines and the three lines next to the change stay visible

#### Scenario: Added text keeps the purpose and drops the delta heading

- **WHEN** the baseline has a Purpose section and the delta appends a requirement under ADDED Requirements
- **THEN** the rows contain the Purpose line and the new requirement, and contain no ADDED heading

#### Scenario: Earlier scenarios fold up to the requirement heading

- **WHEN** a later scenario replaces one line and an earlier scenario stands between that line and the requirement heading
- **THEN** the requirement heading and the later scenario heading are visible, and the earlier scenario and the requirement body are inside a gap

### Requirement: An opened gap stays open until the capability closes

Choosing a gap SHALL show its lines. Choosing that gap again SHALL leave the lines shown. Closing the capability and opening it again SHALL hide those lines.

#### Scenario: A second click leaves the gap open

- **WHEN** a gap is open and the person chooses it again
- **THEN** the gap stays open

#### Scenario: Closing the capability hides the lines again

- **WHEN** a gap is open and the person closes that capability
- **THEN** the gap is closed

### Requirement: The fold control sits apart from the spec text

The fold control SHALL be centered. The first capability SHALL NOT have a rule above it. A commentable diff row SHALL be one control, so the line numbers and the text highlight and receive the comment together.

#### Scenario: The fold control is centered and the list has no rule above it

- **WHEN** the drawer shows a capability diff
- **THEN** the fold control is centered and the first capability has no top rule

### Requirement: A line comment uses a thread when the line has an anchor

A row copied from the delta SHALL carry an anchor: the delta path, the line number in that file, and side `right`. Choosing that row and sending text SHALL call `openThread` with the person's text only. A row without an anchor SHALL call `speak` with the visible line quoted above the text. A refused thread SHALL call `speak` with the same quote and SHALL NOT put the host error in the snapshot. Both calls failing SHALL yield `комментарий не записан`. A Plan body line SHALL carry an anchor to that line of `proposal.md`. An open question SHALL stay a conversation reply.

#### Scenario: A line copied from the delta opens a thread

- **WHEN** the person comments a line that the delta contributed and one pull request is open
- **THEN** the review thread is opened on the delta path at the delta line with the person's text only

#### Scenario: A baseline line quotes the pull request

- **WHEN** the person comments a line that was not copied from the delta and one pull request is open
- **THEN** the pull request conversation receives the visible line as a quote and the person's text

#### Scenario: A refused thread is quoted

- **WHEN** the thread call fails and the conversation call succeeds
- **THEN** the conversation receives the quote and the snapshot does not contain the host error

#### Scenario: Both writes failing leave the comment unrecorded

- **WHEN** the thread call fails and the conversation call fails
- **THEN** the snapshot status is `комментарий не записан`

#### Scenario: A plan line opens a thread on proposal.md

- **WHEN** the person comments a body line of the plan and one pull request is open
- **THEN** the review thread is opened on `proposal.md` at that file line

#### Scenario: An open question stays a conversation reply

- **WHEN** the person answers an open question line of the plan
- **THEN** the conversation receives that question as an open checkbox and does not open a thread

### Requirement: A task opens its scenario

A task button SHALL find `#### Scenario:` in the diff rows, including rows hidden inside a gap.

#### Scenario: A task opens the scenario inside a gap

- **WHEN** the scenario line is hidden inside a gap and the person activates the task button
- **THEN** the jump target names that capability, that gap, and that scenario name

### Requirement: GitHub sends the side of the thread

GitHub SHALL send `RIGHT` for `right` and `LEFT` for `left`. A plain thread body SHALL be posted without the robot mark.

#### Scenario: A plain right-side thread is unmarked

- **WHEN** a thread is opened with side `right` and a plain body
- **THEN** the request carries `side=RIGHT` and the body has no robot mark

### Requirement: Arcanum posts a published thread on the active diff

Arcanum SHALL resolve `entry_id` from the changelist of the active diff, post `is_draft` false, send `new` for `right` and `old` for `left`, and set `size` to 1. A path missing from the changelist SHALL fail the call.

#### Scenario: A published thread uses the changelist entry

- **WHEN** a thread is opened on a file that is in the active diff changelist
- **THEN** the comment is posted with that entry, `is_draft` false, side `new`, and size 1

#### Scenario: A missing file fails the thread

- **WHEN** a thread is opened on a file that is not in the changelist
- **THEN** the call fails and no comment is posted
