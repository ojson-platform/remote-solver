# spec-row

## Purpose

Specify shows each spec line as a row of text. The row keeps addition and deletion coloring, and the row itself is the comment control. A click opens the remark draft. A row with no anchor still opens that draft and shows no posted line comment.

## Requirements

### Requirement: The row keeps addition and deletion coloring

An added row SHALL carry the classes `diff-row` and `add`. A deleted row SHALL carry the classes `diff-row` and `del`. An unchanged row SHALL carry the classes `diff-row` and `ctx`. When the spec has no addition and no deletion, the row SHALL also carry the class `plain`.

A changed span of a replaced line SHALL be `span.bit`. An unchanged span of that line SHALL NOT be `span.bit`. A line that has no changed span SHALL have no `span.bit`.

#### Scenario: Added, deleted, and unchanged rows keep their classes

- **WHEN** the person opens Specify on a spec that has an added line, a deleted line, and an unchanged line
- **THEN** the added row carries `diff-row` and `add`, the deleted row carries `diff-row` and `del`, and the unchanged row carries `diff-row` and `ctx`

#### Scenario: A changed span is marked

- **WHEN** the person opens Specify on a replaced line and one span of that line changed
- **THEN** that changed span is `span.bit`, and an unchanged span of that line is not `span.bit`

#### Scenario: A changed marked word is marked on the painted span

- **WHEN** the person opens Specify on a replaced line whose changed token is the marked word **бета**
- **THEN** the painted span of that line is `span.bit`

#### Scenario: A changed link or underscore emphasis is marked on the painted span

- **WHEN** the person opens Specify on a replaced line whose changed token is a link, and on a replaced line whose changed token is underscore emphasis
- **THEN** the row renders that link and that emphasis, the painted span of that link is `span.bit`, the painted span of that emphasis is `span.bit`, and an unchanged span of that line is not `span.bit`

#### Scenario: A line with no changed span has no marked span

- **WHEN** the person opens Specify on a line that has no changed span
- **THEN** the row has no `span.bit`

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

### Requirement: The fold bar stays and the row has no line number

A fold of unchanged lines SHALL be a fold bar, and that bar SHALL NOT be the comment control. A spec row SHALL NOT show a line number.

#### Scenario: A changed row has no line number and the fold bar is separate

- **WHEN** the person opens Specify on a spec that has a change and a fold of unchanged lines
- **THEN** the fold is a fold bar separate from the row, and the changed row shows no line number

#### Scenario: An unchanged spec shows no line number

- **WHEN** the person opens Specify on a spec that has no addition and no deletion
- **THEN** each row shows no line number

#### Scenario: A code block stays one row per source line

- **WHEN** the person opens Specify on a changed spec line that contains a code block, and the following line is another spec line
- **THEN** that code line stays one row, the row shows no line number, and the following row is the next source line

#### Scenario: A fence marker stays a row

- **WHEN** the person opens Specify on a source line that is a fence marker, and the following line is the next source line
- **THEN** that line stays a row, the fence marks do not stay characters of the text, the row shows no line number, and the following row is the next source line

### Requirement: The row renders the line as markdown

The spec row SHALL render the line as markdown. A heading SHALL show its depth. A heading, a list, emphasis, a link, and code in that line SHALL render as markdown, and their marks SHALL NOT stay characters of the text. When a code span's position spans two source lines, the row SHALL show the paint of its own line. A line the value does not contain SHALL NOT show the raw source.

#### Scenario: A marked line renders as markdown

- **WHEN** the person opens Specify on a heading line, a list line, and a line that contains emphasis, a link, and code
- **THEN** the row renders that heading at its depth, that list, that emphasis, that link, and that code as markdown, the list row does not show the characters `- list item`, and the heading mark, the list mark, the emphasis marks, the link marks, and the code marks do not stay characters of the text

#### Scenario: A code span across two source lines shows the paint of its own line

- **WHEN** the person opens Specify on a code span whose position spans two source lines, with gamma delta on the first source line and epsilon on the next, the node value is gamma delta followed by epsilon, and that value does not contain the first covered line
- **THEN** the first row shows the paint of its own line and does not show the raw source of the first covered line, the next row shows the paint of its own line and does not show the raw source of that line, and a line the value does not contain does not show the raw source
