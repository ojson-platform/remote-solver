# focus-prose

## Purpose

The written prose under the badge is the words after the marker, shown as written. The marker line is the badge and is not a heading. This surface has no line comment and no diff row. A jump in that prose is handled before a line click.

## Requirements

### Requirement: The written prose is the words after the marker

The words after the marker SHALL be shown under the badge as written, including the line breaks. A heading mark, a list mark, emphasis, a link mark, and a code mark SHALL stay the characters that were written. The marker line SHALL be the badge and SHALL NOT be a heading of that prose.

#### Scenario: Marks stay the characters that were written

- **WHEN** the person opens a written focus whose prose contains a heading mark, a list, emphasis, a link, and code
- **THEN** those words are shown under the badge as written, including the line breaks, the heading mark, the list mark, the emphasis marks, the link marks, and the code marks stay the characters that were written, and the marker line is the badge and is not a heading

### Requirement: This surface has no line comment and no diff row

The written prose SHALL show no line comment and no diff row.

#### Scenario: The written prose has no line comment and no diff row

- **WHEN** the person opens a written focus
- **THEN** the prose shows no line comment and no diff row

### Requirement: A jump is handled before a line click

A click on a `button.jump` in the written prose SHALL be handled before a line click. That click SHALL NOT open a line comment.

#### Scenario: A jump is handled before a line click

- **WHEN** the person clicks a `button.jump` in the written prose
- **THEN** that click is handled before a line click and does not open a line comment
