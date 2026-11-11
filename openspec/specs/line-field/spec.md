# line-field

## Purpose

A document line and a document remark take a comment in the pool frame. Where the comment is written is `openspec/specs/spec-diff/spec.md`.

## Requirements

### Requirement: A line field opens on a document line

When one pull request is open, each non-empty line of the plan and of the design SHALL highlight while the pointer is over it, or while that line's field is open.

The line text SHALL stay aligned with the section headings.

The highlight SHALL change the background and SHALL NOT draw a bar on the left.

A click SHALL open a field on that line.

A second click on a line whose field is empty SHALL close that field.

A second click on a line whose field holds text SHALL leave it open.

#### Scenario: A line field uses the pool frame

A field that already holds text SHALL stay open when another line is opened.

An empty field SHALL close when another line is opened.

The field SHALL close from a cross, and from Escape when the caret is inside it.

Sending the field SHALL follow `openspec/specs/spec-diff/spec.md`.

A comment field SHALL be the pool card.

A line field SHALL sit below its line so its close circle clears the text.

The document remark SHALL use the line field's inset and SHALL sit as far below the block above it as a line field sits below its line.

A focused field SHALL turn that hairline brass.

The line field's close control SHALL be a circled cross on the field's top-right corner.

The send mark SHALL sit inside the field.

- **WHEN** one pull request is open and the cycle is open
- **THEN** the line field is the pool card and sits below its line so its close circle clears the text, its close control is a circle, its send mark sits inside it, and a focused field uses a brass hairline. The document remark uses that same inset and sits as far below the block above it as the line field sits below its line. The line highlight changes the background, the line text stays aligned with the section headings, and the highlight draws no bar on the left

#### Scenario: A hovered line draws no bar on the left

- **WHEN** the pointer is over a plan or design line, or that line's field is open
- **THEN** the line changes only its background and draws no bar on the left

#### Scenario: A typed line comment stays when another line opens

- **WHEN** a line field holds text and the manager opens another line
- **THEN** that field stays and the other line opens its own

#### Scenario: An empty line field closes when another line opens

- **WHEN** a line field is empty and the manager opens another line
- **THEN** the empty field closes and the other line opens its own

#### Scenario: An empty line field closes when its line is clicked again

- **WHEN** a line field is empty and the manager clicks that same line
- **THEN** the field closes

#### Scenario: A typed line comment stays when its line is clicked again

- **WHEN** a line field holds text and the manager clicks that same line
- **THEN** the field stays

#### Scenario: Escape closes the line field

- **WHEN** a line field is open and the caret is inside it and the manager presses Escape
- **THEN** the field closes

### Requirement: A document remark is a review comment

A Plan, Specify, or Design row with one open pull request SHALL offer a comment when that document is present, or when that row is the one the plaque can still accept. An Accept row with one open pull request SHALL offer that same comment. That comment SHALL be a review comment of the text the manager wrote.

#### Scenario: A remark on the plan is a review comment

- **WHEN** the manager writes a comment on the Plan row and one pull request is open
- **THEN** the review comment is that text

#### Scenario: A remark on accepting is a review comment

- **WHEN** the manager writes a comment on the Accept row and one pull request is open
- **THEN** the Accept row offers the comment, and the review comment is that text
