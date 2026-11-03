## RENAMED Requirements

- FROM: `### Requirement: Focus is a new issue comment after a signal`
- TO: `### Requirement: The skill writes a focus comment when the artifact is published`
- FROM: `### Requirement: The window shows the body after the marker line`
- TO: `### Requirement: The sidebar focus block shows the latest focus prose`

## MODIFIED Requirements

### Requirement: The skill writes a focus comment when the artifact is published

The skill of the phase SHALL write a focus comment when that phase's artifact is published. The comment SHALL be prose for one phase, or prose for the whole pull request. The first line SHALL be the marker `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, `sdd:focus:code`, or `sdd:focus` for the whole pull request. Older focus comments SHALL remain. The same text SHALL NOT add another comment. The machine SHALL NOT append the layer ledger (`Plan solid`, `thread N`, `file:line`) as the comment a person reads. A run with no signal SHALL leave the latest focus comment unchanged. The skill SHALL NOT write a focus comment when the cycle has no change file.

#### Scenario: The skill of the phase writes this comment when the artifact is published

- **WHEN** the phase's artifact is published and this focus comment is already visible, together with the layer ledger (`Plan solid`, `thread N`, `file:line`)
- **THEN** the skill of the phase writes this comment

#### Scenario: A focus comment is prose for one phase or the whole pull request

- **WHEN** a focus comment that is prose for one phase is already visible, together with a focus comment that is prose for the whole pull request
- **THEN** a focus comment is prose for one phase, or for the whole pull request

#### Scenario: The first line is the marker sdd:focus:plan, sdd:focus:spec, sdd:focus:design, sdd:focus:tasks, sdd:focus:code, or sdd:focus

- **WHEN** focus comments are already visible whose first lines are the markers `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, and `sdd:focus:code`, together with a whole-pull-request comment whose first line is the marker `sdd:focus`
- **THEN** the first line is the marker `sdd:focus:plan`, `sdd:focus:spec`, `sdd:focus:design`, `sdd:focus:tasks`, `sdd:focus:code`, or `sdd:focus` for the whole pull request

#### Scenario: The layer ledger is not the comment a person reads

- **WHEN** the comment a person reads is already visible, together with the layer ledger (`Plan solid`, `thread N`, `file:line`)
- **THEN** the machine does not append the layer ledger (`Plan solid`, `thread N`, `file:line`) as the comment a person reads

#### Scenario: Older focus comments remain

- **WHEN** an older focus comment is already visible, together with a newer focus comment
- **THEN** the older focus comment remains

#### Scenario: The same text does not add another comment

- **WHEN** a focus comment with this text is already visible, together with the same text written again
- **THEN** the same text does not add another comment

#### Scenario: No signal leaves the comment

- **WHEN** a step run ends with no signal and a focus comment is already visible
- **THEN** that focus comment stays unchanged

#### Scenario: No change file means no focus comment

- **WHEN** the cycle has no change file and a step run ends with Publish
- **THEN** the issue gains no focus comment

### Requirement: The sidebar focus block shows the latest focus prose

The sidebar focus block SHALL show the latest focus comment, with that marker as a badge and the prose under it. The window SHALL NOT recompute the prose. The spine row of that phase SHALL keep the first sentence of its own latest phase comment. A whole-pull-request comment SHALL belong to the focus block and to no single row. An ask, a role outcome, and a manager's comment SHALL NOT become the focus block.

#### Scenario: The sidebar focus block shows the latest marker as a badge and the prose under it

- **WHEN** the sidebar focus block, the latest focus comment, that marker, that badge, and the prose under it are already visible, together with an older focus comment
- **THEN** the sidebar focus block shows the latest of these, with that marker as a badge, and the prose under it

#### Scenario: The spine row of that phase keeps the first sentence of its own latest phase comment

- **WHEN** the spine row of that phase is already visible and the first sentence of its own latest phase comment is already visible, together with a whole-pull-request comment
- **THEN** the spine row of that phase keeps the first sentence of its own latest phase comment

#### Scenario: A whole-pull-request comment belongs to the focus block and to no single row

- **WHEN** a whole-pull-request comment and the focus block are already visible, together with a single spine row
- **THEN** the whole-pull-request comment belongs to the focus block and to no single row

#### Scenario: A manager comment is not the focus block

- **WHEN** the latest issue comment is the manager's and an older comment is a focus comment
- **THEN** the focus block is that older comment, with its marker as a badge and its prose under the badge

### Requirement: A marker lands on the mirror name

The focus names SHALL be the mirror names. A `proposal` marker SHALL land on Plan, `spec` on Specify, `design` on Design, `tasks` on Tasks, and `code` on Code. Change SHALL be the change directory and SHALL NOT take a thread. Phase movement SHALL stay on `sdd:layer=` threads.

#### Scenario: Phase movement stays on sdd:layer= threads

- **WHEN** phase movement is already visible on a thread whose marker is `sdd:layer=spec`, together with a focus comment
- **THEN** phase movement stays on `sdd:layer=` threads, and the `spec` marker lands on Specify

#### Scenario: Change takes no thread

- **WHEN** the change directory exists
- **THEN** no thread is planted on Change

## ADDED Requirements

### Requirement: The prose says what the phase produced

The prose SHALL say what this phase produced. When something is weak or must be looked at, the prose SHALL say that too. When the artifact still has open questions, the prose SHALL point at them by place and count and SHALL NOT restate them. A clean phase SHALL omit the weak-spot sentence. A phase with no open questions SHALL omit the pointer. There SHALL be no fixed heading the writer fills in.

#### Scenario: The prose says what this phase produced

- **WHEN** what this phase produced is already visible, together with a fixed heading
- **THEN** the prose says what this phase produced

#### Scenario: Something weak or that must be looked at is said too

- **WHEN** something weak or that must be looked at is already visible, together with a clean phase
- **THEN** the prose says that too

#### Scenario: Open questions are pointed at by place and count

- **WHEN** the artifact still has open questions and their place and count are already visible, together with the text of those questions
- **THEN** the prose points at them by place and count and does not restate them

#### Scenario: A clean phase omits the weak-spot sentence

- **WHEN** a clean phase is already visible, together with a weak-spot sentence
- **THEN** a clean phase omits the weak-spot sentence

#### Scenario: A phase with no open questions omits the pointer

- **WHEN** a phase with no open questions is already visible, together with a pointer by place and count
- **THEN** a phase with no open questions omits the pointer

#### Scenario: There is no fixed heading the writer fills in

- **WHEN** the focus prose is already visible, together with a fixed heading the writer fills in
- **THEN** there is no fixed heading the writer fills in

## REMOVED Requirements

### Requirement: A layer is written when its file exists

### Requirement: A gap is one pointer and a why line
