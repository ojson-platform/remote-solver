# sidebar

## Purpose

The sidebar is the open cycle beside the board. It shows focus, phase lines, and the hook. It does not show the icon reason, the ask, or a review title. A cycle in the pool and a cycle in a column are read the same way.

## Requirements

### Requirement: The open row does not show the icon reason

The open row SHALL NOT show the icon reason. The closed card SHALL keep its reason line. When the row has no reason, the open row SHALL still have no reason block.

#### Scenario: The open row does not repeat the card line

- **WHEN** the closed plaque's reason line is longer than the plaque shows
- **THEN** the open row has no reason block and the card keeps its line

#### Scenario: No icon means no reason block

- **WHEN** the row has no reason
- **THEN** the open row has no icon reason block

### Requirement: The open row has no ask block

The open row SHALL NOT show an ask block, including while the issue carries `sdd:wait-human`.

#### Scenario: A waiting issue has no ask block

- **WHEN** the issue carries `sdd:wait-human` and the latest issue comment does not start with `sdd:focus`
- **THEN** the open row has no ask block

#### Scenario: A focus comment leaves no ask block

- **WHEN** the issue carries `sdd:wait-human` and the latest comment starts with `sdd:focus`, and an older comment does not
- **THEN** the open row has no ask block

#### Scenario: Clearing the label leaves no ask block

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

### Requirement: The open row does not show the unanswered review

The open row SHALL NOT show an unanswered block. An unmarked thread and the conversation's last comment SHALL stay off the focus. A thread that names a file SHALL stay on its phase row.

#### Scenario: An unmarked thread stays off the focus

- **WHEN** the pull request has a thread whose latest marker is absent and the thread names no file
- **THEN** the open row has no unanswered block

#### Scenario: A conversation comment stays off the focus

- **WHEN** the conversation's last comment has no marker
- **THEN** the open row has no unanswered block

### Requirement: The hook block shows sddHooks in field order

The hook block SHALL show each string point of `sddHooks` as the action, the point name, and the paragraph, in the order of the field.

A newline SHALL stay inside the paragraph.

An action or a point other than `before` or `after` SHALL keep its place in that order.

A point whose value is not a string SHALL show the action, the point name, and the line `поле хука не читается`, and the other points of that map SHALL remain.

#### Scenario: Points stay in field order

A readable map with no points, a missing field, and an empty value SHALL leave no hook block.

A value that is not a map SHALL show one line `поле хука не читается` and no paragraphs.

After a role writes the field, the open row SHALL show the new field.

The window SHALL NOT write `sddHooks`.

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

### Requirement: The open row shows only the blocks that exist

The open row SHALL show only the blocks that exist: focus, phase lines, and the hook. It SHALL NOT show the icon reason or the ask. An absent block SHALL leave no empty place.

#### Scenario: A cycle with only focus shows focus

- **WHEN** the open cycle has an `sdd:focus` comment and has no ask, no unanswered review, no hook block, and no icon
- **THEN** the open row shows the focus block and no empty place above it
