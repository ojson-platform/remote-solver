# Spec Delta

## ADDED Requirements

### Requirement: The prose renders markdown

The words after the marker SHALL be rendered as markdown beside the badge. A heading, a list, emphasis, a link, and code SHALL render, and their marks SHALL NOT stay the characters that were written. Those words SHALL stay the words that were written.

#### Scenario: The prose renders markdown

- **WHEN** the person opens a written focus whose prose contains a heading, a list, emphasis, a link, and code
- **THEN** the prose beside the badge renders that heading, that list, that emphasis, that link, and that code, and the heading mark, the list mark, the emphasis marks, the link marks, and the code marks do not stay the characters that were written

#### Scenario: The prose is rendered beside the badge

- **WHEN** the person opens a written focus
- **THEN** the prose beside the badge is rendered, and the written characters are not left literal

#### Scenario: The words after the marker are not rewritten

- **WHEN** the person opens a written focus
- **THEN** the prose beside the badge is the words after the marker and those words are not rewritten

### Requirement: The marker line stays the badge and is not a heading

The marker line SHALL be the badge and SHALL be the first line. That line SHALL NOT be a heading of the prose.

#### Scenario: The marker line stays the badge and is not a heading

- **WHEN** the person opens a written focus
- **THEN** the marker line is the badge, the badge is the first line, and that line is not a heading

### Requirement: A scenario name stays a button.jump

A scenario name in the written prose SHALL stay a `button.jump`.

#### Scenario: A scenario name stays a button.jump

- **WHEN** the person opens a written focus whose prose contains a scenario name
- **THEN** that scenario name is a `button.jump`

### Requirement: The live page sentence is not the written prose

The prose beside the badge SHALL be the written prose and SHALL NOT be the live page sentence.

#### Scenario: The live page sentence is not the written prose

- **WHEN** the person opens a written focus
- **THEN** the prose beside the badge is the written prose and is not the live page sentence

## REMOVED Requirements

### Requirement: The written prose is the words after the marker
