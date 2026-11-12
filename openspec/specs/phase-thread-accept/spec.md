# phase-thread-accept

## Purpose

On Plan, Specify, and Design, what acceptance does while a review thread is open. The phase row and the machine do not agree.

## Requirements

### Requirement: Acceptance stays active while a review thread is open

On Plan, Specify, and Design, when that row would show acceptance if no review thread were open, the row SHALL show an active «Принять» in the gate's place. An open review thread SHALL NOT make the control inactive. The control SHALL be named «Принять» and the phase, and SHALL NOT say that a thread on that phase is still open.

The machine, for a thread that counts as this phase, does not ask to accept. The row shows the control anyway.

#### Scenario: A phase thread leaves acceptance active

- **WHEN** the row is Plan, Specify, or Design, that row would show acceptance if no review thread were open, and a review thread is open
- **THEN** the row shows an active «Принять» named with that phase, in the gate's place, and the control does not say that a thread is still open

### Requirement: A thread of this phase withholds the accept ask

On proposing, specifying, and designing, when one pull request is open, an open review thread that counts as this phase SHALL keep the machine from setting `sdd:wait-human` and from asking to accept the phase. A `sdd:wait-human` label that is already present SHALL stay, and the machine SHALL NOT ask again.

A thread with no marker counts as this phase, except a thread that sits on an open question or an open decision. The machine classifies that thread and does not ask.

A thread marked for this phase counts. The machine continues that phase and does not ask, when the pull request conversation does not end in an unmarked person comment. An unmarked person comment on the conversation is classified first.

A thread marked only for a later phase does not count. A note does not count. The machine then sets `sdd:wait-human`, when that label is absent, and asks to accept the phase. This does not hold for a thread that sits on an open question or an open decision, and it does not hold when the phase would pass without a person or when the phase is sent back to write its document.

#### Scenario: An unmarked thread is classified instead of the ask

- **WHEN** the phase is proposing, specifying, or designing, one pull request is open, `sdd:wait-human` is absent, and an open review thread has no marker and does not sit on an open question or an open decision
- **THEN** the machine classifies the thread, does not set `sdd:wait-human`, and does not ask to accept the phase

#### Scenario: A thread of this phase continues the phase instead of the ask

- **WHEN** the phase is proposing, specifying, or designing, one pull request is open, `sdd:wait-human` is absent, an open review thread is marked for that phase, and the pull request conversation does not end in an unmarked person comment
- **THEN** the machine continues that phase, does not set `sdd:wait-human`, and does not ask to accept it

#### Scenario: A later-phase thread still opens the ask

- **WHEN** the phase is proposing, the proposal is present, no question is open, one pull request is open, `sdd:auto-plan` is absent, `sdd:wait-human` is absent, the only open review thread is marked for a later phase and does not sit on an open question, and the pull request conversation does not end in an unmarked person comment
- **THEN** the machine sets `sdd:wait-human` and asks to accept the plan

#### Scenario: A note still opens the ask

- **WHEN** the phase is designing, the specs are ready, the design is present, no decision is open, the design is not behind the specs, one pull request is open, `sdd:auto-design` is absent, `sdd:wait-human` is absent, the only open review thread is a note and does not sit on an open decision, and the pull request conversation does not end in an unmarked person comment
- **THEN** the machine sets `sdd:wait-human` and asks to accept the design
