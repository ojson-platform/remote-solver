# sidebar

## Purpose

The sidebar is the open cycle beside the board. It shows the icon reason, the ask, focus, unanswered review, and the hook. A cycle in the pool and a cycle in a column are read the same way.

## Requirements

### Requirement: The icon reason block is the card's line

The icon reason block SHALL show the row's reason line in full. When the plaque moves a question or decision count onto the phase row and drops that line, the open row SHALL still show the count. When the row has no reason, the block SHALL be absent.

#### Scenario: The open row shows the hidden tail

- **WHEN** the closed plaque's reason line is longer than the plaque shows
- **THEN** the open row shows the whole line

#### Scenario: No icon means no reason block

- **WHEN** the row has no reason
- **THEN** the open row has no icon reason block

### Requirement: Ask shows the latest comment that is not focus

The ask block SHALL be present while the issue carries `sdd:wait-human`, and it SHALL show the latest issue comment whose first line is not `sdd:focus`. The open row SHALL show that text in full. When the label is removed, the block SHALL go, even if comments remain. A later focus comment SHALL NOT take the ask's place.

#### Scenario: Wait shows the ask

- **WHEN** the issue carries `sdd:wait-human` and the latest issue comment does not start with `sdd:focus`
- **THEN** the ask block shows that comment

#### Scenario: A focus comment is skipped

- **WHEN** the issue carries `sdd:wait-human` and the latest comment starts with `sdd:focus`, and an older comment does not
- **THEN** the ask block shows the latest comment that does not start with `sdd:focus`

#### Scenario: Clearing the label removes the ask

- **WHEN** `sdd:wait-human` is removed and the comments remain
- **THEN** the open row has no ask block

### Requirement: Focus shows the body after the marker line

The focus block SHALL show the body after the first line `sdd:focus` of the latest such comment. When the cycle has no `sdd:focus` comment, the block SHALL be absent. The window SHALL NOT recompute the record.

#### Scenario: The plaque drops the marker line

- **WHEN** the latest focus comment starts with `sdd:focus` and the next line names a gap
- **THEN** the focus block shows the gap line and does not show the marker line

#### Scenario: No focus comment leaves no block

- **WHEN** the cycle has no comment that starts with `sdd:focus`
- **THEN** the open row has no focus block

### Requirement: Unanswered review shows threads the port already gives

The unanswered block SHALL be present when a thread has no marker, or the conversation's last comment has no marker. It SHALL show the thread lines and the last conversation comment the review port already gives. When there is no such thread and no such conversation, the block SHALL be absent.

#### Scenario: An unmarked thread is shown

- **WHEN** the pull request has a thread whose latest marker is absent
- **THEN** the unanswered block shows that thread

#### Scenario: A marked thread is omitted

- **WHEN** every open thread has a marker and the conversation's last comment has a marker
- **THEN** the open row has no unanswered block

### Requirement: The hook block shows sddHooks in field order

The hook block SHALL show each string point of `sddHooks` as the action, the point name, and the paragraph, in the order of the field. A newline SHALL stay inside the paragraph. An action or a point other than `before` or `after` SHALL keep its place in that order. A point whose value is not a string SHALL show the action, the point name, and the line `поле хука не читается`, and the other points of that map SHALL remain. A readable map with no points, a missing field, and an empty value SHALL leave no hook block. A value that is not a map SHALL show one line `поле хука не читается` and no paragraphs. After a role writes the field, the open row SHALL show the new field. The window SHALL NOT write `sddHooks`.

#### Scenario: Points stay in field order

- **WHEN** `sddHooks` lists `archive.before` and then `create-proposal.after`
- **THEN** the hook block shows `archive` `before` first and `create-proposal` `after` second

#### Scenario: An empty field leaves no block

- **WHEN** `sddHooks` is missing, empty, or a map with no points
- **THEN** the open row has no hook block

#### Scenario: A non-map is one error line

- **WHEN** `sddHooks` is a single string
- **THEN** the hook block is the line `поле хука не читается`

#### Scenario: A non-string point keeps the others

- **WHEN** one point is not a string and another point is a string
- **THEN** the bad point shows `поле хука не читается` and the string point remains

### Requirement: The open row shows only the blocks the cycle has

The open cycle SHALL open a sidebar over the board, from the right, at `min(560px, 92vw)`, and SHALL NOT narrow the stations. There SHALL be no rail and no shelf. One cycle SHALL be open: opening another SHALL close the previous, and a second click on the open cycle SHALL close it. The sidebar SHALL show the full title when the tile cuts it, then only the blocks that exist, top to bottom: the icon reason and the ask. Then the verbs. Then a spine of rows in focus order: Plan, Specify, Design, Tasks, Code, and Accept. The Change row SHALL NOT be shown. Each document row SHALL keep the sentence from the latest `sdd:focus` comment, and when that comment is absent SHALL keep the sentence from the issue body between `sdd:begin` and `sdd:end`. The Plan row SHALL show the first line of Outcome in place of that sentence. When Outcome has no line, the Plan row SHALL keep its sentence. When a cycle opens, the row of the plaque's layer SHALL be open. A second click on that open row SHALL close it, and every row MAY then be closed. A click on a row head outside its gate or acceptance control SHALL toggle that row, including the space the control opens above and below the name. Plan SHALL show every `##` section of `proposal.md` that has text, including each later paragraph. A `##` section with no text SHALL NOT be shown. A `###` heading SHALL be a subsection heading. An Open questions section with no question SHALL NOT be shown. While a question is open, that section SHALL say that the plan is accepted only once no question is open. When the issue branch exists, that file SHALL be the copy on the issue branch. When it does not, that file SHALL be the copy in the checkout. The collapsed Plan row SHALL show the first line of Outcome once, cut with an ellipsis, and SHALL NOT repeat the Plan sentence beside it. The open Plan row SHALL hide that line and SHALL NOT show the Plan sentence. Specify SHALL show each capability's changed requirements. Design SHALL show the first paragraph of the verification boundary, the first paragraph of the approach, each rejected line, and the open decisions from `design.md`. Tasks SHALL list the scenario names from `tasks.md`, and a scenario name SHALL name the capability that owns it. Code SHALL show the check and whether a diff is present, and, when they exist, the unanswered review and the hook. Accept SHALL carry the accepting gate. An absent block SHALL leave no empty place. The sidebar block list SHALL NOT copy the change files. The window SHALL NOT write these blocks. An answer to an open question SHALL be a review comment on the one open pull request, and the question line in `proposal.md` SHALL stay. A Plan, Specify, or Design row with one open pull request SHALL offer a comment when that document is present, or when that row is the one the plaque can still accept. That comment SHALL be a review comment of the text the manager wrote. When one pull request is open, each non-empty line of the plan SHALL highlight while the pointer is over it. That highlight SHALL have 4px above and below and 8px on each side, the line text SHALL stay aligned with the section headings, and the highlight SHALL be rounded at 8px. A click SHALL open a field on that line. A second click on a line whose field is empty SHALL close that field. A second click on a line whose field holds text SHALL leave it open. A field that already holds text SHALL stay open when another line is opened. An empty field SHALL close when another line is opened. The field SHALL close from a cross, and from Escape when the caret is inside it. The review comment for that line SHALL open a review thread on `openspec/changes/issue-<key>/proposal.md` at that file line, on side `right`, containing only the text the manager wrote. A comment field SHALL sit 10px in from each side and 6px below the text above it, with the pool card's 8px radius and hairline. The text inside a comment field SHALL sit 8px in from each side of the frame. A line field SHALL sit 18px below its line, so its close circle clears the text. The document remark SHALL use the line field's 10px side inset and 8px bottom inset, and SHALL sit as far below the block above it as a line field sits below its line. A focused field SHALL turn that hairline brass. The line field's close control SHALL be a circled cross on the field's top-right corner. The open row's head SHALL stick to the top of the sidebar scroll. The Plan row SHALL offer acceptance in the gate's place when the plaque is `proposing`, the proposal is present, no question is open, and one pull request is open. The acceptance control SHALL use the plaque's 8px radius, a 12px label, and padding of 4px 10px. Acceptance SHALL add `sdd:proposed` and SHALL leave `sdd:proposing`. The Design row SHALL do the same for `designing` with `sdd:designed`. The Specify row SHALL offer acceptance when the plaque is `specifying`, one pull request is open, and the specs are ready. The specs are ready when the change has a delta file, or when the proposal names no capability under Added or Modified. A baseline spec under `openspec/specs/` SHALL NOT by itself make the specs ready. A missing baseline for a Modified capability SHALL NOT offer acceptance. While this cycle's action is `restore-baseline`, `create-initial-specs`, or `improve-specs`, the row SHALL NOT offer acceptance. That acceptance SHALL add `sdd:specified` and SHALL leave `sdd:specifying`. Acceptance SHALL NOT write the next phase. The settings sheet SHALL NOT open itself. Every close control SHALL be a cross. The sheet SHALL have one close control.

#### Scenario: A cycle with only focus shows focus

- **WHEN** the open cycle has an `sdd:focus` comment and has no ask, no unanswered review, no hook block, and no icon
- **THEN** the open row shows the focus block and no empty place above it

#### Scenario: Change bodies stay out

- **WHEN** the cycle has a `proposal.md`
- **THEN** the sidebar block list does not include that file

#### Scenario: The Plan row shows the outcome

- **WHEN** `proposal.md` has an Outcome section, the cycle is open, and the issue branch does not exist
- **THEN** the sidebar shows that Outcome from the checkout on the Plan row

#### Scenario: The Plan row shows every section

- **WHEN** `proposal.md` has Scope and Out of scope, Scope has two paragraphs, and the cycle is open
- **THEN** the Plan row shows both headings and both paragraphs

#### Scenario: A collapsed Plan row shows one outcome line

- **WHEN** the Plan row is closed and Outcome has two lines
- **THEN** the closed row fills the sidebar width, shows the first line once in an excerpt cut with an ellipsis, does not repeat the Plan sentence, and the open row hides that excerpt and does not show the Plan sentence

#### Scenario: A plan line opens a thread

- **WHEN** one pull request is open and the manager comments on a plan line
- **THEN** the review thread is opened on `openspec/changes/issue-<key>/proposal.md` at that file line with only the manager's text, and the pull-request conversation receives no quote

#### Scenario: A line field uses the pool frame

- **WHEN** one pull request is open and the cycle is open
- **THEN** the line field sits 10px in from each side and 18px below its line so its close circle clears the text, its text sits 8px in from each side of the frame, its radius is 8px, its close control is a circle, its send mark sits inside it, and a focused field uses a brass hairline. The document remark uses that same side inset and bottom inset, and sits as far below the block above it as the line field sits below its line. The line highlight has 4px above and below and 8px on each side, the line text stays aligned with the section headings, and the highlight is rounded at 8px

#### Scenario: The row head toggles outside its control

- **WHEN** a cycle is open and a row head shows a control taller than its name
- **THEN** a click on the head outside that control toggles the row, a click on the control does not, and the head, including the space around the name, uses a pointer

#### Scenario: The open row head sticks

- **WHEN** a cycle is open
- **THEN** the open row's head sticks to the top of the sidebar scroll and spans the sidebar width

#### Scenario: An empty plan section stays out

- **WHEN** `proposal.md` has a section with text and a section with no text, and the cycle is open
- **THEN** the Plan row shows the section with text and does not show the empty heading

#### Scenario: Added and Modified are headings

- **WHEN** Capabilities contains `### Added` and `### Modified`, and the cycle is open
- **THEN** the Plan row shows Added and Modified as headings

#### Scenario: An empty Open questions section stays out

- **WHEN** Open questions has no question and the cycle is open
- **THEN** the Plan row does not show Open questions

#### Scenario: An open question holds the plan

- **WHEN** Open questions has an open item and the cycle is open
- **THEN** the Plan row says the plan is accepted only once no question is open

#### Scenario: A typed line comment stays when another line opens

- **WHEN** a line field holds text and the manager opens another line
- **THEN** that field stays and the other line opens its own

#### Scenario: An empty line field closes when its line is clicked again

- **WHEN** a line field is empty and the manager clicks that same line
- **THEN** the field closes

#### Scenario: A typed line comment stays when its line is clicked again

- **WHEN** a line field holds text and the manager clicks that same line
- **THEN** the field stays

#### Scenario: An empty line field closes when another line opens

- **WHEN** a line field is empty and the manager opens another line
- **THEN** the empty field closes and the other line opens its own

#### Scenario: Escape closes the line field

- **WHEN** a line field is open and the caret is inside it and the manager presses Escape
- **THEN** the field closes

#### Scenario: The Design row shows the named parts

- **WHEN** `design.md` has a verification boundary, an approach, a rejected line, an open decision, and other prose, and the cycle is open
- **THEN** the Design row shows the first paragraph of the boundary, the first paragraph of the approach, the rejected line, and the open decision, and does not show the other prose

#### Scenario: The Code row shows that a diff is present

- **WHEN** the cycle has a diff and is open
- **THEN** the Code row says a diff is present and does not show the patch

#### Scenario: The sidebar is a wide drawer

- **WHEN** a cycle is open
- **THEN** the sidebar is a fixed drawer on the right, `min(560px, 92vw)` wide, and the stations keep their width

#### Scenario: The Plan row reads the issue branch

- **WHEN** `proposal.md` on `sdd/<key>` differs from `proposal.md` in the checkout working tree and the cycle is open
- **THEN** the Plan row shows the proposal from the issue branch

#### Scenario: An answer is a review comment

- **WHEN** an open question is a line `- [ ]` and the manager answers it on the one open pull request
- **THEN** the review comment quotes that line and the answer, and `proposal.md` still has the open line. An empty answer is shown between the header and the board and is absent on the next load. A written answer does not show a success line there

#### Scenario: A remark on the plan is a review comment

- **WHEN** the manager writes a comment on the Plan row and one pull request is open
- **THEN** the review comment is that text

#### Scenario: Accepting the plan adds proposed

- **WHEN** the plaque is `proposing`, the proposal has no open question, one pull request is open, and the manager accepts the plan
- **THEN** the issue gains `sdd:proposed`, keeps `sdd:proposing`, and the window does not write the next phase. The page does not show `Принято` between the header and the board

#### Scenario: Accepting the spec adds specified

- **WHEN** the plaque is `specifying`, the change has a delta requirement, one pull request is open, and the manager accepts the spec
- **THEN** the issue gains `sdd:specified` and keeps `sdd:specifying`

#### Scenario: Accepting the design adds designed

- **WHEN** the plaque is `designing`, the design has no open decision, one pull request is open, and the manager accepts the design
- **THEN** the issue gains `sdd:designed` and keeps `sdd:designing`

#### Scenario: Opening another row closes the previous

- **WHEN** one row is open and the manager opens another
- **THEN** the previous row closes and the new row is the only open row

#### Scenario: The Change row stays out

- **WHEN** a cycle is open
- **THEN** the sidebar spine does not show a Change row

#### Scenario: A second click closes the open row

- **WHEN** a cycle is open on its plaque row and the manager clicks that row's head again
- **THEN** no spine row is open

#### Scenario: An open row does not narrow its neighbors

- **WHEN** a row opens
- **THEN** the station widths of the other rows stay as they were

#### Scenario: The settings sheet has one close button

- **WHEN** the manager opens settings
- **THEN** the sheet has one close control, that control is a cross, and the sheet did not open itself

#### Scenario: A second click closes the cycle

- **WHEN** a cycle is open and the manager clicks it again
- **THEN** the sidebar closes and the cycle is no longer open

### Requirement: The open row shows three gate lines

The spine SHALL show a gate button on Plan, Specify, Design, and Accept, for `proposing`, `specifying`, `designing`, and `accepting`, except on the row of the phase the plaque is standing on when that phase is `proposing`, `specifying`, or `designing`. That row SHALL NOT show its gate button. When that row offers acceptance, the acceptance SHALL stand where the gate stood. When it does not, that place SHALL be empty. The Accept row SHALL keep its gate while the plaque is `accepting`. Every other gate SHALL stay, including when the board station is a door, a plaque, or a dot. The button face SHALL be the sign alone. The set sign SHALL be 18px. The empty sign SHALL be the smaller circle. Its accessible name SHALL stay «Поставить гейт …» or «Снять гейт …». A click in the sidebar SHALL write or remove that one label even when the board would not.

#### Scenario: A passed gate is controlled from the sidebar

- **WHEN** the plaque is on `implementing` and `sdd:auto-plan` is set
- **THEN** the board `proposing` station is a dot, and the sidebar line is the circle «Поставить гейт proposing» whose click removes `sdd:auto-plan`. That circle is smaller than the set sign

#### Scenario: A future gate repeats the station button

- **WHEN** the plaque is on `proposing` and `designing` has a door
- **THEN** the `designing` line in the sidebar has the gate button, and that sign is 18px

#### Scenario: The current phase shows acceptance instead of its gate

- **WHEN** the plaque is `proposing`, the proposal has no open question, one pull request is open, and the cycle is open
- **THEN** the Plan row shows acceptance where the gate stood, that control has the plaque's 8px radius, a 12px label, and padding of 4px 10px, the row does not show the proposing gate, and the designing line still has its gate

#### Scenario: An open question leaves the current gate's place empty

- **WHEN** the plaque is `proposing`, Open questions has an open item, one pull request is open, and the cycle is open
- **THEN** the Plan row shows neither acceptance nor the proposing gate

#### Scenario: An empty delta offers acceptance

- **WHEN** the plaque is `specifying`, the change has a delta file with no requirement, one pull request is open, and the cycle is open
- **THEN** the Specify row shows acceptance and does not show the specifying gate

#### Scenario: A spec turn hides acceptance

- **WHEN** the plaque is `specifying`, the change has a delta requirement, one pull request is open, the cycle is open, and the action is `restore-baseline`, `create-initial-specs`, or `improve-specs`
- **THEN** the Specify row shows neither acceptance nor the specifying gate

#### Scenario: A proposal with no capability offers acceptance

- **WHEN** the plaque is `specifying`, the proposal names no capability, the change has no delta file, one pull request is open, and the cycle is open
- **THEN** the Specify row shows acceptance and does not show the specifying gate

#### Scenario: A named capability without a delta leaves the place empty

- **WHEN** the plaque is `specifying`, the proposal names a capability, a baseline spec has a requirement, the change has no delta file, one pull request is open, and the cycle is open
- **THEN** the Specify row shows neither acceptance nor the specifying gate

#### Scenario: A missing baseline leaves the place empty

- **WHEN** the plaque is `specifying`, the proposal names a Modified capability whose baseline is absent, the change delta has a requirement, one pull request is open, and the cycle is open
- **THEN** the Specify row shows neither acceptance nor the specifying gate
