# spec-row

## Purpose

Specify shows each spec line as a row of text. The row keeps addition and deletion coloring, and the row itself is the comment control. A click opens the remark draft. A row with no anchor still opens that draft and shows no posted line comment.

## Requirements

### Requirement: The row shows the line as text

The spec row SHALL show the line as text. A heading mark, a list mark, emphasis, a link, and code in that line SHALL stay characters of that text.

#### Scenario: A marked line stays text

- **WHEN** the person opens Specify on a spec line that contains a heading mark, a list mark, emphasis, a link, and code
- **THEN** the row shows that line as text, and those marks stay characters of the text

### Requirement: The row keeps addition and deletion coloring

An added row SHALL carry the classes `diff-row` and `add`. A deleted row SHALL carry the classes `diff-row` and `del`. An unchanged row SHALL carry the classes `diff-row` and `ctx`. When the spec has no addition and no deletion, the row SHALL also carry the class `plain`.

A changed span of a replaced line SHALL be `span.bit`. An unchanged span of that line SHALL NOT be `span.bit`. A line that has no changed span SHALL show its text with no `span.bit`.

#### Scenario: Added, deleted, and unchanged rows keep their classes

- **WHEN** the person opens Specify on a spec that has an added line, a deleted line, and an unchanged line
- **THEN** the added row carries `diff-row` and `add`, the deleted row carries `diff-row` and `del`, and the unchanged row carries `diff-row` and `ctx`

#### Scenario: A changed span is marked

- **WHEN** the person opens Specify on a replaced line and one span of that line changed
- **THEN** that changed span is `span.bit`, and an unchanged span of that line is not `span.bit`

#### Scenario: A line with no changed span has no marked span

- **WHEN** the person opens Specify on a line that has no changed span
- **THEN** the row shows that line as text and has no `span.bit`

#### Scenario: An unchanged spec row is plain

- **WHEN** the person opens Specify on a spec that has no addition and no deletion
- **THEN** each row carries `diff-row`, `ctx`, and `plain`

### Requirement: The comment control is the row

When a pull request is open and the line has text, the row SHALL be the comment control. That control SHALL be the row button with class `diff-row`, and SHALL NOT be a `button.line`. `data-line` SHALL be the line text.

When no pull request is open, or the line has no text, the row SHALL NOT be a comment control.

#### Scenario: The row button is the comment control

- **WHEN** a pull request is open and the person opens Specify on a spec line that has text
- **THEN** the row is a `diff-row` button, it is not a `button.line`, and `data-line` is that line text

#### Scenario: A row with no pull request is not a comment control

- **WHEN** no pull request is open and the person opens Specify on a spec line that has text
- **THEN** the row is not a comment control

#### Scenario: A line with no text is not a comment control

- **WHEN** a pull request is open and the person opens Specify on a spec line that has no text
- **THEN** the row is not a comment control

### Requirement: A click opens the remark draft

When a pull request is open, the line has text, and that line has no remark draft, a click on the row SHALL open the remark draft on that line.

#### Scenario: A click opens the remark draft

- **WHEN** a pull request is open and the person clicks a spec row whose line has text and has no remark draft
- **THEN** the remark draft opens on that line

### Requirement: An anchored row carries the file, the line, and the right side

When the row is the comment control and the row has an anchor, `data-path` SHALL be the anchored file, `data-at` SHALL be the anchored line, and `data-side` SHALL be `right`.

#### Scenario: An anchored row carries the file, the line, and the right side

- **WHEN** a pull request is open and the person opens Specify on a spec row that has text and an anchor
- **THEN** the row's `data-path` is the anchored file, `data-at` is the anchored line, and `data-side` is `right`

### Requirement: A row with no anchor still opens a draft and shows no posted line comment

When the row is the comment control and the row has no anchor, a click SHALL open the remark draft, and the row SHALL show no posted line comment.

#### Scenario: A row with no anchor opens a draft and shows no posted line comment

- **WHEN** a pull request is open and the person clicks a spec row that has text, has no anchor, and has no remark draft
- **THEN** the remark draft opens on that line and the row shows no posted line comment

### Requirement: The scenario name stays on the row

A line that names a scenario SHALL carry `data-scenario` with that scenario name.

#### Scenario: A scenario line carries its scenario name

- **WHEN** the person opens Specify on a line that names a scenario
- **THEN** the row carries `data-scenario` with that scenario name

### Requirement: The line numbers and the fold bar stay

On a changed spec, the row SHALL show a baseline number cell and a folded number cell, and a cell with no number SHALL be empty. On a spec with no addition and no deletion, the row SHALL show one line number. A fold of unchanged lines SHALL be a fold bar, and that bar SHALL NOT be the comment control.

#### Scenario: A changed row keeps both number cells and the fold bar is separate

- **WHEN** the person opens Specify on a spec that has a change and a fold of unchanged lines
- **THEN** a changed row shows a baseline number cell and a folded number cell, and the fold is a fold bar separate from the row

#### Scenario: An unchanged spec shows one line number

- **WHEN** the person opens Specify on a spec that has no addition and no deletion
- **THEN** each row shows one line number
