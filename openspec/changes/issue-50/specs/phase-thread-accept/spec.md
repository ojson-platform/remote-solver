<!--
sdd-absorbed: 3517434d8d0cc8e8
-->

## RENAMED Requirements

- FROM: `### Requirement: Acceptance stays active while a review thread is open`
- TO: `### Requirement: Acceptance stays inactive while a thread of this phase is open`

## MODIFIED Requirements

### Requirement: Acceptance stays inactive while a thread of this phase is open

On Plan, Specify, and Design, when that row would show acceptance if no review thread were open, a thread that counts as this phase SHALL leave «Принять» inactive in the gate's place. Hovering it SHALL name the phase and SHALL say that a thread on that phase is still open. A thread with no marker counts as this phase, and one marked for this phase counts. A thread marked for a later phase does not, and a note does not. An open question SHALL still leave that place empty.

#### Scenario: A phase thread leaves acceptance active

- **WHEN** the row is Plan, Specify, or Design, that row would show acceptance if no review thread were open, a review thread is open, and no open review thread counts as this phase
- **THEN** the row shows an active «Принять» named with that phase, in the gate's place, and the control does not say that a thread is still open

#### Scenario: On Plan, Specify, and Design, «Принять» stays in the gate's place

- **WHEN** Plan, Specify, and Design, «Принять», and the gate's place are already visible, that row would show acceptance if no review thread were open, and a thread that counts as this phase is open, together with «Принять» leaving the gate's place as the limit that can replace this stay
- **THEN** on Plan, Specify, and Design, «Принять» stays in the gate's place

#### Scenario: The control is inactive while this phase has an unclosed review thread

- **WHEN** the control, this phase, and an unclosed review thread marked for this phase are already visible, that row would show acceptance if no review thread were open, and the control is already inactive, together with an active control as the limit that can replace this inactivity
- **THEN** the control is inactive while this phase has an unclosed review thread

#### Scenario: Hovering it names the phase and says a thread on that phase is still open

- **WHEN** hovering the inactive control, the phase, and a thread on that phase are already visible, together with a hover that does not name the phase and does not say that a thread is still open as the limit that can replace this hover
- **THEN** hovering it names the phase and says a thread on that phase is still open

#### Scenario: A thread with no marker counts as this phase

- **WHEN** a thread with no marker and this phase are already visible, the control is already inactive in the gate's place, and hovering it already names the phase and says a thread on that phase is still open, together with a thread with no marker that does not count as this phase as the limit that can replace this count
- **THEN** a thread with no marker counts as this phase

#### Scenario: A thread marked for a later phase does not

- **WHEN** a thread marked for a later phase, an active «Принять» in the gate's place, and a control that does not say that a thread is still open are already visible, and that row would show acceptance if no review thread were open, together with that thread counting as this phase as the limit that can replace this refusal
- **THEN** a thread marked for a later phase does not, and the row shows an active «Принять» in the gate's place that does not say a thread is still open

#### Scenario: A note does not

- **WHEN** a note, an active «Принять» in the gate's place, and a control that does not say that a thread is still open are already visible, and that row would show acceptance if no review thread were open, together with a note counting as this phase as the limit that can replace this refusal
- **THEN** a note does not, and the row shows an active «Принять» in the gate's place that does not say a thread is still open

#### Scenario: An open question still leaves that place empty, as it does now

- **WHEN** an open question, that place, and an unclosed review thread of this phase are already visible, and that place is already empty, together with «Принять» in that place as the limit that can replace this emptiness
- **THEN** an open question still leaves that place empty, as it does now

### Requirement: A thread of this phase withholds the accept ask

On proposing, specifying, and designing, when one pull request is open, an open review thread that counts as this phase SHALL keep the machine from setting `sdd:wait-human` and from asking to accept the phase. A `sdd:wait-human` label that is already present SHALL stay, and the machine SHALL NOT ask again.

A thread with no marker counts as this phase, except a thread that sits on an open question or an open decision. The machine does not set `sdd:wait-human` and does not ask to accept the phase.

A thread marked for this phase counts. The machine continues that phase and does not ask, when the pull request conversation does not end in an unmarked person comment. An unmarked person comment on the conversation is classified first.

A thread marked only for a later phase does not count. A note does not count. The machine then sets `sdd:wait-human`, when that label is absent, and asks to accept the phase. This does not hold for a thread that sits on an open question or an open decision, and it does not hold when the phase would pass without a person or when the phase is sent back to write its document.

#### Scenario: A thread of this phase continues the phase instead of the ask

- **WHEN** the phase is proposing, specifying, or designing, one pull request is open, `sdd:wait-human` is absent, an open review thread is marked for that phase, and the pull request conversation does not end in an unmarked person comment
- **THEN** the machine continues that phase, does not set `sdd:wait-human`, and does not ask to accept it

#### Scenario: A later-phase thread still opens the ask

- **WHEN** the phase is proposing, the proposal is present, no question is open, one pull request is open, `sdd:auto-plan` is absent, `sdd:wait-human` is absent, the only open review thread is marked for a later phase and does not sit on an open question, and the pull request conversation does not end in an unmarked person comment
- **THEN** the machine sets `sdd:wait-human` and asks to accept the plan

#### Scenario: A note still opens the ask

- **WHEN** the phase is designing, the specs are ready, the design is present, no decision is open, the design is not behind the specs, one pull request is open, `sdd:auto-design` is absent, `sdd:wait-human` is absent, the only open review thread is a note and does not sit on an open decision, and the pull request conversation does not end in an unmarked person comment
- **THEN** the machine sets `sdd:wait-human` and asks to accept the design
