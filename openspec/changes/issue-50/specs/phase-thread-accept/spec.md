# Spec Delta

## Purpose

Keeps «Принять» in the gate's place on Plan, Specify, and Design while that phase has an unclosed review thread, and keeps the machine from asking to accept the phase.

## ADDED Requirements

### Requirement: Accept stays in the gate's place

On Plan, Specify, and Design, «Принять» SHALL stay in the gate's place.

#### Scenario: On Plan, Specify, and Design, «Принять» stays in the gate's place

- **WHEN** Plan, Specify, Design, «Принять», and the gate's place are already visible, together with the empty place an open question leaves as the limit that can replace «Принять»
- **THEN** on Plan, Specify, and Design, «Принять» stays in the gate's place

### Requirement: The control is inactive while this phase has an unclosed review thread

The control SHALL be inactive while this phase has an unclosed review thread.

#### Scenario: The control is inactive while this phase has an unclosed review thread

- **WHEN** the control, this phase, and an unclosed review thread are already visible, together with a thread marked for a later phase as the limit that can replace that unclosed review thread
- **THEN** the control is inactive while this phase has an unclosed review thread

### Requirement: Hovering names the phase and the open thread

Hovering the control SHALL name the phase and SHALL say a thread on that phase is still open.

#### Scenario: Hovering it names the phase and says a thread on that phase is still open

- **WHEN** hovering, the phase, and a thread on that phase are already visible, together with a thread marked for a later phase as the limit that can replace that thread
- **THEN** hovering it names the phase and says a thread on that phase is still open

### Requirement: A thread with no marker counts as this phase

A thread with no marker SHALL count as this phase.

#### Scenario: A thread with no marker counts as this phase

- **WHEN** a thread with no marker and this phase are already visible, together with a thread marked for a later phase as the limit that can replace that thread with no marker
- **THEN** a thread with no marker counts as this phase

### Requirement: A thread marked for a later phase does not count as this phase

A thread marked for a later phase SHALL NOT count as this phase.

#### Scenario: A thread marked for a later phase does not count as this phase

- **WHEN** a thread marked for a later phase is already visible, together with a thread with no marker as the limit that can replace that later-phase thread
- **THEN** a thread marked for a later phase does not count as this phase

### Requirement: A note does not count as this phase

A note SHALL NOT count as this phase.

#### Scenario: A note does not count as this phase

- **WHEN** a note is already visible, together with a thread with no marker as the limit that can replace that note
- **THEN** a note does not count as this phase

### Requirement: An open question leaves that place empty

An open question SHALL still leave that place empty, as it does now.

#### Scenario: An open question still leaves that place empty, as it does now

- **WHEN** an open question and that empty place are already visible, together with an unclosed review thread of this phase as the limit that can replace that open question
- **THEN** an open question still leaves that place empty, as it does now

### Requirement: An open thread does not ask to accept the phase

While such a thread is open, the machine SHALL NOT set `sdd:wait-human` and SHALL NOT ask to accept the phase.

#### Scenario: While such a thread is open, the machine does not set sdd:wait-human and does not ask to accept the phase

- **WHEN** such a thread, `sdd:wait-human`, and the ask to accept the phase are already visible, together with a thread marked for a later phase as the limit that can replace such a thread
- **THEN** while such a thread is open, the machine does not set `sdd:wait-human` and does not ask to accept the phase
