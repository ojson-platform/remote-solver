# task-line Specification

## Purpose
A task file in the change sidebar renders each source line as markdown, keeps that line a comment target, and paints the remark draft when the line is clicked. A level-three heading stays a button, the line is not a diff row, and the path stays the task file.

## Requirements

### Requirement: Each source line renders markdown

Each source line of a task file in the change sidebar SHALL render as markdown. That rendering SHALL include headings, lists, emphasis, links, and code.

#### Scenario: Each source line renders headings, lists, emphasis, links, and code

- **WHEN** the caller opens a task file in the change sidebar whose source lines contain a heading, a list, emphasis, a link, and code
- **THEN** each of those source lines renders that heading, that list, that emphasis, that link, and that code as markdown

### Requirement: The line stays a comment target

A source line of a task file in the change sidebar SHALL stay a comment target.

#### Scenario: The line stays a comment target

- **WHEN** the caller opens a task file in the change sidebar
- **THEN** each source line stays a comment target

### Requirement: A click opens the remark draft

A click on a source line of a task file in the change sidebar SHALL open the remark draft for that line.

#### Scenario: A click opens the remark draft

- **WHEN** the caller clicks one source line of a task file in the change sidebar while another source line is also shown
- **THEN** the remark draft opens for the clicked line and does not open for the other line

### Requirement: There is no diff row

A source line of a task file in the change sidebar SHALL NOT be a diff row.

#### Scenario: There is no diff row

- **WHEN** the caller opens a task file in the change sidebar
- **THEN** no source line is a diff row

### Requirement: A level-three heading stays a button

A `###` source line of a task file in the change sidebar SHALL stay a button.

#### Scenario: A level-three heading stays a button

- **WHEN** the caller opens a task file in the change sidebar on a source line that is a `###` heading
- **THEN** that `###` line stays a button

### Requirement: The path stays the task file

The path of a task file in the change sidebar SHALL stay `<readPath>/tasks/<id>.md`.

#### Scenario: The path stays the task file

- **WHEN** the caller opens a task from the change sidebar
- **THEN** the path is `<readPath>/tasks/<id>.md`

### Requirement: The task file paints the remark draft

The task file in the change sidebar SHALL paint the remark draft that the click stored.

#### Scenario: The task file paints the remark draft the click stored

- **WHEN** the caller clicks a source line of a task file in the change sidebar
- **THEN** that task file paints the remark draft the click stored
