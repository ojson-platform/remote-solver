# focus

## Purpose

Focus is the machine's record on a cycle of which layers are solid and which gaps remain. The window shows that record and does not recompute it. How the machine chooses a gap is not part of this spec.

## Requirements

### Requirement: Focus is a new issue comment after a signal

The machine SHALL append a new issue comment when a step run ends with signal Publish, Wait, or Hand-off and the text differs from the latest `sdd:focus` comment. The comment SHALL start with the line `sdd:focus`. Older focus comments SHALL remain. The same text SHALL NOT add another comment. A run with no signal SHALL leave the plaque unchanged. The machine SHALL NOT write a focus comment until the cycle has at least one change file.

#### Scenario: A signal with new text appends a comment

- **WHEN** a step run ends with Publish and the focus text differs from the latest `sdd:focus` comment
- **THEN** the issue gains a new comment that starts with `sdd:focus`

#### Scenario: The same text adds nothing

- **WHEN** a step run ends with Wait and the focus text equals the latest `sdd:focus` comment
- **THEN** the issue gains no focus comment

#### Scenario: No signal leaves the plaque

- **WHEN** a step run ends with no signal
- **THEN** the latest `sdd:focus` comment stays the plaque

#### Scenario: No change file means no focus comment

- **WHEN** the cycle has no change file and a step run ends with Publish
- **THEN** the issue gains no `sdd:focus` comment

### Requirement: The window shows the body after the marker line

The window SHALL show the body after the line `sdd:focus` and SHALL NOT recompute it. An ask, a role outcome, and a manager's comment SHALL NOT become the plaque.

#### Scenario: A manager comment is not the plaque

- **WHEN** the latest issue comment is the manager's and an older comment starts with `sdd:focus`
- **THEN** the plaque is the body of that older comment

### Requirement: A layer is written when its file exists

The record SHALL list a layer only when its file already exists, in this order: Change, Plan, Specify, Design, Tasks, Code. Change SHALL be written when the change directory exists, and it SHALL then be `solid`. Plan SHALL be written when `proposal.md` exists. Code SHALL be written when the pull request has a diff. A missing layer SHALL be omitted. A layer line SHALL be `solid` or a list of gaps. Change, Plan, and Tasks with no thread of their own SHALL be `solid`. A thread on a layer line SHALL be a gap of kind `thread`.

#### Scenario: Change is solid when the directory exists

- **WHEN** the change directory exists and `proposal.md` does not
- **THEN** the record lists Change as `solid` and omits Plan

#### Scenario: Code is omitted without a diff

- **WHEN** the pull request has no diff
- **THEN** the record omits Code

### Requirement: A marker lands on the mirror name

The focus names SHALL be the mirror names. A `proposal` marker SHALL land on Plan, `spec` on Specify, `design` on Design, `tasks` on Tasks, and `code` on Code. Change SHALL be the change directory and SHALL NOT take a thread.

#### Scenario: A spec marker lands on Specify

- **WHEN** a thread's latest marker is `spec`
- **THEN** that thread is a gap on Specify

#### Scenario: Change takes no thread

- **WHEN** the change directory exists
- **THEN** no thread is planted on Change

### Requirement: A gap is one pointer and a why line

A gap SHALL be one per pointer. The why line SHALL name every cause of that pointer, in the cycle's prose. Layer names, `solid`, and gap kinds SHALL be the terms. A requirement name SHALL stay as it is in the spec. The service config SHALL have no language key. A coverage count and diff text SHALL NOT be in the comment. The window SHALL NOT show pointers or the why line on the card.

A `requirement` pointer on Specify SHALL name the capability id and the requirement name. A `boundary` pointer on Design SHALL name the capability id. A `thread` pointer SHALL name the thread handle, on the layer of the thread's marker. A review place on Code SHALL name the file and the line on the pull request, and it SHALL open at the URL the port gives: Arcanum on Tracker, the pull request page on GitHub.

#### Scenario: A requirement pointer names the requirement

- **WHEN** Specify has a gap of kind `requirement`
- **THEN** the pointer names the capability id and the requirement name, and the why line names the causes of that pointer

#### Scenario: A review place opens the port URL

- **WHEN** Code has a review place and the manager opens it on Tracker
- **THEN** the window opens the Arcanum URL the port gives

#### Scenario: The comment has no coverage count

- **WHEN** the machine appends an `sdd:focus` comment
- **THEN** the comment has no coverage count and no diff text
