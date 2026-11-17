# chat-session

## Purpose

One chat drives one issue until the machine waits or the issue is done. The next message in that chat continues the same issue.

## Requirements

### Requirement: The chat runs until the machine waits

A step that ends in Publish or Hand-off SHALL run `step` again. A printed `advance` SHALL run `step` again. A step that leaves no Publish, no Hand-off, and no Wait SHALL stop. A printed `wait` or `done` SHALL stop. The printed `step` SHALL be the action text the chat follows, and the chat SHALL NOT open the step file.

#### Scenario: A commit or a hand-off runs step again

- **WHEN** the step ends in Publish or Hand-off
- **THEN** the chat runs `step` again and follows the printed decision

#### Scenario: A paused advance runs step again

- **WHEN** `step` prints `advance`
- **THEN** the chat runs `step` again and does not apply that move itself

#### Scenario: An action with no signal stops

- **WHEN** the step leaves no Publish, no Hand-off, and no Wait
- **THEN** the chat stops

#### Scenario: Wait or done stops the chat

- **WHEN** `step` prints `wait` or `done`
- **THEN** the chat stops

#### Scenario: The chat follows the printed step

- **WHEN** `step` prints an agent decision
- **THEN** the chat follows that decision's `step` text and does not open the step file

### Requirement: The stop tells the person what happened

The stop message SHALL say what the run finished, why it stopped, and the files that matter for this stop as links. The printed reason SHALL be a fact in that message. The message SHALL NOT reuse a fixed wording.

#### Scenario: The stop names the work, the cause, and the files

- **WHEN** the chat stops
- **THEN** the message says what the run finished, why it stopped, and names the files that matter as links, and the printed reason is a fact in that message rather than the whole message

### Requirement: The next message stays in the session

The next message SHALL continue the same issue. The skill SHALL NOT ask for `/sdd-flow` again. Agreement on a gate SHALL accept and run `step`. Agreement after a stop with no signal SHALL run `step`. A request to change the artifact SHALL publish, unwait, and run `step`.

#### Scenario: Agreement on a gate continues

- **WHEN** the person agrees and the printed decision has a gate
- **THEN** the chat accepts that gate and runs `step`

#### Scenario: Agreement after an empty action continues

- **WHEN** the person agrees after a stop with no signal
- **THEN** the chat runs `step` again

#### Scenario: A change continues

- **WHEN** the person asks to change the artifact
- **THEN** the chat edits it, publishes, clears the wait, and runs `step`

#### Scenario: The person is not asked to invoke the skill again

- **WHEN** the chat is waiting
- **THEN** the skill does not ask for `/sdd-flow` again, and the next message continues this session
