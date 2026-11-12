# wait

## Purpose

`wait` tells a person what to do. The label alone does not.

## Requirements

### Requirement: Wait comments the ask

`wait` SHALL require the sentence the person is to act on. Without that sentence the command SHALL fail and SHALL NOT set `wait-human`. With it, the machine SHALL set `wait-human` and comment on the issue. The comment's first line, after a robot prefix, SHALL be `sdd:wait-human`, and the rest SHALL be that sentence. A review-gate comment SHALL NOT use that first line.

#### Scenario: Wait without a sentence is refused

- **WHEN** `wait` is run with no sentence
- **THEN** the command fails and `wait-human` is not set

#### Scenario: Wait posts the sentence

- **WHEN** `wait` is run with a sentence
- **THEN** the issue carries `wait-human`, the comment's first line is `sdd:wait-human`, and the next line is that sentence

### Requirement: Unwait clears the label

`unwait` SHALL remove `wait-human`. When the label is absent, `unwait` SHALL change nothing.

#### Scenario: Unwait removes the label

- **WHEN** `unwait` runs on an issue that carries `wait-human`
- **THEN** the label is removed

#### Scenario: Unwait on an issue that is not waiting

- **WHEN** `unwait` runs on an issue that has no `wait-human`
- **THEN** the labels stay as they were

### Requirement: Continue clears a refusal

When the label `sdd:refused` is on and the open page is that refusal, Continue SHALL remove `sdd:refused`. It SHALL leave `sdd:wait-human` as it was.

#### Scenario: Continue removes the refusal label

- **WHEN** the issue carries `sdd:refused` and the decision is `refused implement-next-task: next open task`
- **THEN** the page offers `Продолжить`, and the click removes `sdd:refused`

### Requirement: Continue clears only the label

Continue SHALL remove `wait-human` and SHALL NOT check that the ask was fulfilled. The control SHALL be absent while acceptance is offered, while the settled decision is an agent, and while the checkout repair is open.

#### Scenario: Continue removes the label

- **WHEN** the issue carries `wait-human` and the open row offers Continue
- **THEN** the label is removed and the phase stays

#### Scenario: Continue is absent beside acceptance

- **WHEN** acceptance is offered on the current writing phase
- **THEN** the open row has no Continue control
