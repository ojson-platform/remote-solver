# step-handoff

## Purpose

A step that cannot finish the file leaves a hand-off the next poll can read.

## Requirements

### Requirement: Specify hands a proposal fault back

The specify step SHALL hand the capability list, the problem, the scope, or the last requirement of a baseline to `proposal`, and SHALL keep the spec files.

#### Scenario: Specify hands the capability list to proposal

- **WHEN** the specify step finds the capability list, the problem, the scope, or the last requirement of a baseline wrong
- **THEN** its instruction is a hand-off to `proposal` on `proposal.md` and the spec files stay

### Requirement: Tasks cuts a slice and hands off what it cannot verify

The tasks step SHALL publish one `tasks/<id>.md` per slice. Scenarios of one observation SHALL share that card. Each scenario SHALL sit in one slice.

A verification boundary with no command SHALL be a hand-off to `design`. A scenario in two tasks, in none, or a task with no anchor SHALL be fixed before the commit. A scenario no caller path can verify SHALL be a hand-off to `spec`.

#### Scenario: A verification boundary with no command hands off to design

- **WHEN** a capability's verification boundary names no command
- **THEN** the tasks step hands that capability to `design` and does not write the card

#### Scenario: A scenario in two tasks is fixed before the commit

- **WHEN** a scenario sits in two tasks, in none, or a task has no anchor
- **THEN** the tasks step fixes that before the commit

#### Scenario: A scenario no caller can verify hands off to spec

- **WHEN** a scenario has no caller path that can verify it
- **THEN** the tasks step hands that scenario to `spec`

#### Scenario: Tasks publishes one card per slice

- **WHEN** the tasks step cuts the delta
- **THEN** it writes one card per slice, scenarios of one observation share that card, and each scenario sits in one slice

### Requirement: Verify hands a failure to the layer that owns it

The verify step SHALL write no files. A THEN that names the behavior SHALL be a hand-off to `code`. A validate failure that names a spec file SHALL be a hand-off to `spec`. No test line SHALL be `sdd:note` and a Wait. Infrastructure only SHALL be a Wait.

#### Scenario: A failure that names behavior hands off to code

- **WHEN** a failing log's THEN names the behavior
- **THEN** the verify step hands that failure to `code` and writes no files

#### Scenario: A validate failure that names a spec file hands off to spec

- **WHEN** validate names a spec file
- **THEN** the verify step hands that file to `spec`

#### Scenario: No test line is a note and a wait

- **WHEN** a failure has no test line
- **THEN** the verify step posts `sdd:note` and Waits

#### Scenario: Infrastructure only waits

- **WHEN** the failures are infrastructure only
- **THEN** the verify step Waits and writes no files

### Requirement: Classification leaves a marker the next poll reads

The classify step SHALL reply `sdd:layer=<layer> → <phase>` and SHALL leave that thread open. On `verifying` and `accepting` it SHALL say the cause with no marker and Wait. When the phase has a layer row and the conversation asks for work now, it SHALL open a thread with that layer marker. Unless it Waited, it SHALL remove `sdd:wait-human`. A reply `out` SHALL open an issue and resolve the thread.

#### Scenario: Classification replies and leaves the thread open

- **WHEN** an unmarked thread is classified
- **THEN** the reply is `sdd:layer=<layer> → <phase>` and the thread stays open

#### Scenario: Verifying and accepting name the cause and wait

- **WHEN** the phase is `verifying` or `accepting` and the conversation is unanswered
- **THEN** the step says the cause with no marker and Waits, and does not open a `code` thread

#### Scenario: A phase with a layer row opens a thread

- **WHEN** the phase has a layer row and the conversation asks for work now
- **THEN** the step opens a thread whose body starts `sdd:layer=<layer> → <phase>`

#### Scenario: Classification removes the hold unless it waited

- **WHEN** the classify step did not Wait
- **THEN** it removes `sdd:wait-human`

#### Scenario: An out reply resolves the thread

- **WHEN** the reply is `out`
- **THEN** the step opens an issue and resolves the thread

### Requirement: Design writes the question it cannot close

An approach sentence that names an observation no scenario names, or that contradicts a scenario, SHALL be a hand-off to `spec`. The step SHALL NOT publish and SHALL NOT move `sdd-absorbed`.

An init-block `Open questions:` list, or a repository with no one-file command or no layer command, SHALL be written as an unchecked Open decisions item. The step SHALL NOT publish.

#### Scenario: An approach sentence with no scenario hands off to spec

- **WHEN** an approach sentence names an observation no scenario names, or contradicts a scenario
- **THEN** the design step hands that sentence to `spec` and does not publish

#### Scenario: An init question is written as an open decision

- **WHEN** the init block lists `Open questions:`, or the repository has no one-file command or no layer command
- **THEN** the design step writes an unchecked Open decisions item and does not publish

### Requirement: Implement hands off a task it cannot carry

No `tasks/<id>.md`, or a card with no § Artifacts heading, SHALL be a hand-off to `tasks`. A coverage gap outside the task SHALL be a hand-off, not success. Scenarios from two Requirements on one card SHALL be split into their own commit, the checkbox SHALL stay open, and the run SHALL end.

#### Scenario: A missing task card hands off to tasks

- **WHEN** `tasks/<id>.md` is missing or the card has no § Artifacts heading
- **THEN** the implement step hands that line to `tasks` and writes no code

#### Scenario: A coverage gap outside the task is a hand-off

- **WHEN** the suite reports a coverage gap outside this task
- **THEN** the implement step treats that gap as a hand-off and not as success

#### Scenario: Scenarios from two requirements are split before the task

- **WHEN** one card names scenarios from two Requirements
- **THEN** the implement step splits `tasks.md` in its own commit, leaves the checkbox open, and ends the run
