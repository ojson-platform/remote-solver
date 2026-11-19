<!--
sdd-absorbed: 68ce34c407b94bc8
-->

# Spec Delta

## ADDED Requirements

### Requirement: The prose renders markdown

The words after the marker SHALL be rendered as markdown beside the badge. A heading, a list, emphasis, a link, and code SHALL render, and their marks SHALL NOT stay the characters that were written. Those words SHALL stay the words that were written. That prose SHALL NOT be left in a `pre`.

#### Scenario: The prose renders markdown

- **WHEN** the person opens a written focus whose prose contains a heading, a list, emphasis, a link, and code
- **THEN** the prose beside the badge renders that heading, that list, that emphasis, that link, and that code, and the heading mark, the list mark, the emphasis marks, the link marks, and the code marks do not stay the characters that were written

#### Scenario: The prose is rendered beside the badge

- **WHEN** the person opens a written focus
- **THEN** the prose is rendered beside the badge, and it is not left in a `pre`

#### Scenario: The words after the marker are not rewritten

- **WHEN** the person opens a written focus
- **THEN** the badge is the first line, and the prose beside the badge is the words after that line and those words are not rewritten

### Requirement: Marks stay beside the jump button

When a scenario name sits in a list item that spans more than one line, the prose beside the badge SHALL show the list mark in front of the jump button. A heading mark and emphasis marks SHALL stay beside that button the same way. The document paint for that line SHALL NOT include those marks. The paint SHALL run on the text around a scenario name.

#### Scenario: Marks stay beside the jump button

- **WHEN** the person opens a written focus whose prose contains a heading, a list, emphasis, a link, and code, and a scenario name sits in a list item that spans more than one line
- **THEN** the prose beside the badge shows the list mark in front of the jump button, a heading mark and emphasis marks stay beside that button the same way, the document paint for that line does not include those marks, the paint runs on the text around that scenario name, and the heading mark, the list mark, the emphasis marks, the link marks, and the code marks do not stay the characters that were written

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
