# focus-prose

## Purpose

The written prose under the badge is the words after the marker. The marker line is the badge and is not a heading. This surface has no line comment and no diff row. A jump in that prose is handled before a line click.

## Requirements

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
