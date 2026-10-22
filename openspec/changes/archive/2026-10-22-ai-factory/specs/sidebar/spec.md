# sidebar

## Purpose

The sidebar is the open ticket or cycle beside the board. It shows the icon reason, the ask, focus, unanswered review, and the hook. A cycle in the pool and a cycle in a column are read the same way.

## ADDED Requirements

### Requirement: The sidebar shows only the blocks the cycle has

The sidebar SHALL show, top to bottom, only the blocks that exist on this cycle: the icon reason, the ask, focus, unanswered review, and the hook. An absent block SHALL leave no empty place. The bodies of the change documents SHALL NOT be in the sidebar. The mirror SHALL stay in the issue body. The window SHALL NOT write these blocks.

#### Scenario: A cycle with only focus shows focus

- **WHEN** the open cycle has an `sdd:focus` comment and has no ask, no unanswered review, no hook block, and no icon
- **THEN** the sidebar shows the focus block and no empty place above it

#### Scenario: Change bodies stay out

- **WHEN** the cycle has a `proposal.md`
- **THEN** the sidebar does not show the body of `proposal.md`

### Requirement: The icon reason block is the card's line

The icon reason block SHALL be the same one line as on the card, and the sidebar SHALL show that line in full. When the card has no icon, the block SHALL be absent.

#### Scenario: The sidebar shows the hidden tail

- **WHEN** the card's reason line is longer than the card shows
- **THEN** the sidebar shows the whole line

#### Scenario: No icon means no reason block

- **WHEN** the card has no icon
- **THEN** the sidebar has no icon reason block

### Requirement: Ask shows the latest comment that is not focus

The ask block SHALL be present while the issue carries `sdd:wait-human`, and it SHALL show the latest issue comment whose first line is not `sdd:focus`. When the label is removed, the block SHALL go, even if comments remain. A later focus comment SHALL NOT take the ask's place.

#### Scenario: Wait shows the ask

- **WHEN** the issue carries `sdd:wait-human` and the latest issue comment does not start with `sdd:focus`
- **THEN** the ask block shows that comment

#### Scenario: A focus comment is skipped

- **WHEN** the issue carries `sdd:wait-human` and the latest comment starts with `sdd:focus`, and an older comment does not
- **THEN** the ask block shows the latest comment that does not start with `sdd:focus`

#### Scenario: Clearing the label removes the ask

- **WHEN** `sdd:wait-human` is removed and the comments remain
- **THEN** the sidebar has no ask block

### Requirement: Focus shows the body after the marker line

The focus block SHALL show the body after the first line `sdd:focus` of the latest such comment. When the cycle has no `sdd:focus` comment, the block SHALL be absent.

#### Scenario: The plaque drops the marker line

- **WHEN** the latest focus comment starts with `sdd:focus` and the next line names a gap
- **THEN** the focus block shows the gap line and does not show the marker line

#### Scenario: No focus comment leaves no block

- **WHEN** the cycle has no comment that starts with `sdd:focus`
- **THEN** the sidebar has no focus block

### Requirement: Unanswered review shows threads the port already gives

The unanswered block SHALL be present when a thread has no marker, or the conversation's last comment has no marker. It SHALL show the thread lines and the last conversation comment the review port already gives. When there is no such thread and no such conversation, the block SHALL be absent.

#### Scenario: An unmarked thread is shown

- **WHEN** the pull request has a thread whose latest marker is absent
- **THEN** the unanswered block shows that thread

#### Scenario: A marked thread is omitted

- **WHEN** every open thread has a marker and the conversation's last comment has a marker
- **THEN** the sidebar has no unanswered block

### Requirement: The hook block shows sddHooks in field order

The hook block SHALL show each string point of `sddHooks` as the action, the point name, and the paragraph, in the order of the field. A newline SHALL stay inside the paragraph. An action or a point other than `before` or `after` SHALL keep its place in that order. A point whose value is not a string SHALL show the action, the point name, and the line `поле хука не читается`, and the other points of that map SHALL remain. A readable map with no points, a missing field, and an empty value SHALL leave no hook block. A value that is not a map SHALL show one line `поле хука не читается` and no paragraphs. After a role writes the field, the sidebar SHALL show the new field. The window SHALL NOT write `sddHooks`.

#### Scenario: Points stay in field order

- **WHEN** `sddHooks` lists `archive.before` and then `create-proposal.after`
- **THEN** the hook block shows `archive` `before` first and `create-proposal` `after` second

#### Scenario: An empty field leaves no block

- **WHEN** `sddHooks` is missing, empty, or a map with no points
- **THEN** the sidebar has no hook block

#### Scenario: A non-map is one error line

- **WHEN** `sddHooks` is a single string
- **THEN** the hook block is the line `поле хука не читается`

#### Scenario: A non-string point keeps the others

- **WHEN** one point is not a string and another point is a string
- **THEN** the bad point shows `поле хука не читается` and the string point remains
