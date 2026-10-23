# sidebar

## Purpose

The sidebar is the open ticket or cycle beside the board. It shows the icon reason, the ask, focus, unanswered review, and the hook. A cycle in the pool and a cycle in a column are read the same way.
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

The open ticket SHALL open a sidebar over the board, from the right, and SHALL NOT narrow the stations. There SHALL be no rail and no shelf. One ticket SHALL be open: opening another SHALL close the previous, and a second click on the open ticket SHALL close it. The sidebar SHALL show the full title when the tile cuts it, then only the blocks that exist, top to bottom: the icon reason and the ask. Then the verbs. Then a spine of rows in focus order: Change, Plan, Specify, Design, Tasks, Code, and Accept. Each document row SHALL keep the sentence from the latest `sdd:focus` comment, and when that comment is absent SHALL keep the sentence from the issue body between `sdd:begin` and `sdd:end`. One row SHALL be open, the layer of the plaque. Plan SHALL show `proposal.md`. Specify SHALL show each capability's changed requirements. Design SHALL show `design.md`. Tasks SHALL list the scenario names from `tasks.md`, and a scenario name SHALL name the capability that owns it. Code SHALL show the check, the diff, and, when they exist, the unanswered review and the hook. Accept SHALL carry the accepting gate. An absent block SHALL leave no empty place. The sidebar block list SHALL NOT copy the change files. The window SHALL NOT write these blocks. An answer to an open question SHALL be a review comment on the one open pull request, and the question line in `proposal.md` SHALL stay. The settings sheet SHALL NOT open itself. Every close control SHALL be a cross. The sheet SHALL have one close control.

#### Scenario: A cycle with only focus shows focus

- **WHEN** the open cycle has an `sdd:focus` comment and has no ask, no unanswered review, no hook block, and no icon
- **THEN** the open row shows the focus block and no empty place above it

#### Scenario: Change bodies stay out

- **WHEN** the cycle has a `proposal.md`
- **THEN** the sidebar block list does not include that file

#### Scenario: The Plan row shows the outcome

- **WHEN** `proposal.md` has an Outcome section and the ticket is open
- **THEN** the sidebar shows that Outcome on the Plan row

#### Scenario: An answer is a review comment

- **WHEN** an open question is a line `- [ ]` and the manager answers it on the one open pull request
- **THEN** the review comment quotes that line and the answer, and `proposal.md` still has the open line

#### Scenario: Opening another row closes the previous

- **WHEN** one row is open and the manager opens another
- **THEN** the previous row closes and the new row is the only open row

#### Scenario: An open row does not narrow its neighbors

- **WHEN** a row opens
- **THEN** the station widths of the other rows stay as they were

#### Scenario: The settings sheet has one close button

- **WHEN** the manager opens settings
- **THEN** the sheet has one close control, that control is a cross, and the sheet did not open itself

#### Scenario: A second click closes the ticket

- **WHEN** a ticket is open and the manager clicks it again
- **THEN** the sidebar closes and the ticket is no longer open

### Requirement: The open row shows three gate lines

The spine SHALL show four gate buttons, on Plan, Specify, Design, and Accept, for `proposing`, `specifying`, `designing`, and `accepting`. Each SHALL be a gate button, including when the board station is a door, a plaque, or a dot. The button face SHALL be the sign alone. Its accessible name SHALL stay «Поставить гейт …» or «Снять гейт …». A click in the sidebar SHALL write or remove that one label even when the board would not.

#### Scenario: A passed gate is controlled from the sidebar

- **WHEN** the plaque is on `implementing` and `sdd:auto-plan` is set
- **THEN** the board `proposing` station is a dot, and the sidebar line is the circle «Поставить гейт proposing» whose click removes `sdd:auto-plan`

#### Scenario: A future gate repeats the station button

- **WHEN** the plaque is on `proposing` and `designing` has a door
- **THEN** the `designing` line in the sidebar has the gate button

