# wait

## Purpose

`wait` tells a person what to do. The label alone does not.

## Requirements

### Requirement: Wait comments the ask

`wait` SHALL require the sentence the person is to act on. Without that sentence the command SHALL fail and SHALL NOT set `wait-human`. With it, the machine SHALL set `wait-human` and comment that sentence on the issue.

#### Scenario: Wait without a sentence is refused

- **WHEN** `wait` is run with no sentence
- **THEN** the command fails and `wait-human` is not set

#### Scenario: Wait posts the sentence

- **WHEN** `wait` is run with a sentence
- **THEN** the issue carries `wait-human` and the issue comment is that sentence

### Requirement: Unwait clears the label

`unwait` SHALL remove `wait-human`. When the label is absent, `unwait` SHALL change nothing.

#### Scenario: Unwait removes the label

- **WHEN** `unwait` runs on an issue that carries `wait-human`
- **THEN** the label is removed

#### Scenario: Unwait on an issue that is not waiting

- **WHEN** `unwait` runs on an issue that has no `wait-human`
- **THEN** the labels stay as they were
