## Problem

On Plan, Specify, and Design, «Принять» can be taken while this phase has an unclosed review thread. While such a thread is open, the machine sets `sdd:wait-human` and asks to accept the phase.

## Outcome

On Plan, Specify, and Design, «Принять» stays in the gate's place. The control is inactive while this phase has an unclosed review thread. Hovering it names the phase and says a thread on that phase is still open.

A thread with no marker counts as this phase. A thread marked for a later phase does not. A note does not. An open question still leaves that place empty, as it does now.

While such a thread is open, the machine does not set `sdd:wait-human` and does not ask to accept the phase.

## Scope

On Plan, Specify, and Design, «Принять» stays in the gate's place and is inactive while this phase has an unclosed review thread. Hovering it names the phase and says a thread on that phase is still open. A thread with no marker counts as this phase. A thread marked for a later phase does not. A note does not. While such a thread is open, the machine does not set `sdd:wait-human` and does not ask to accept the phase.

## Out of scope

Drawing threads on their lines. The unsent-remark queue. Changing the empty place an open question leaves.

## Constraints

A thread with no marker counts as this phase. A thread marked for a later phase does not. A note does not. An open question still leaves that place empty, as it does now.

Depends: #49

## Capabilities

### Added

- `phase-thread-accept` «Принять» stays in the gate's place and is inactive while this phase has an unclosed review thread, and the machine does not ask to accept the phase

### Modified

## Open questions

none
