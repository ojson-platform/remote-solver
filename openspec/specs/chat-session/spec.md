# chat-session

## Purpose

One chat drives one issue until the machine waits or the issue is done. The next message in that chat continues the same issue.

## Requirements

### Requirement: The chat runs until the machine waits

A step that ends in Publish or Hand-off SHALL run `step` again. A printed `advance` SHALL run `step` again. A step that leaves no Publish, no Hand-off, and no Wait SHALL stop. A printed `wait` that carries `dialog` SHALL show those entries together in the client's question dialog and SHALL NOT stop. A ready answer SHALL be offered only when the entry's text already states that whole answer. The person's own words SHALL always be offered. Each answer SHALL be recorded by that entry's `record`, with the person's words unchanged in place of `<answer>`. The chat SHALL NOT edit the change. It SHALL then run `step` again. When that command exits non-zero, the chat SHALL stop and name the file and the exit. Dismissing SHALL record nothing and stop. A later message that answers these entries SHALL be recorded the same way. A printed `wait` without `dialog`, or `done`, SHALL stop. The printed `step` SHALL carry the issue text, then the upstream block, then the action text with this service's hooks. The chat SHALL follow that text and SHALL NOT open the step file.

#### Scenario: A commit or a hand-off runs step again

- **WHEN** the step ends in Publish or Hand-off
- **THEN** the chat runs `step` again and follows the printed decision

#### Scenario: A paused advance runs step again

- **WHEN** `step` prints `advance`
- **THEN** the chat runs `step` again and does not apply that move itself

#### Scenario: An action with no signal stops

- **WHEN** the step leaves no Publish, no Hand-off, and no Wait
- **THEN** the chat stops

#### Scenario: A dialog does not stop the chat

- **WHEN** `step` prints `wait` with `dialog`
- **THEN** the chat shows every entry together in the client's question dialog, offers a ready answer only when the entry's text already states that whole answer, always leaves a place for the person's own words, records each answer by that entry's `record` with the person's words unchanged in place of `<answer>`, does not edit the change, and runs `step` again
- **AND** dismissing records nothing and stops
- **AND** a command that exits non-zero stops the chat and the message names the file and the exit
- **AND** a later message that answers these entries is recorded the same way

#### Scenario: A wait without a dialog stops the chat

- **WHEN** `step` prints `wait` without `dialog`, or `done`
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

The next message SHALL continue the same issue. The skill SHALL NOT ask for `/sdd-flow` again. Agreement on a gate SHALL accept and run `step`. Agreement after a stop with no signal SHALL run `step`. A request to change the artifact SHALL publish, unwait, and run `step`. A message that answers a printed `dialog` SHALL record those answers and run `step`. A message that only asks where the cycle is SHALL run `step` again and follow Act, and SHALL NOT describe the cycle from an earlier print. Any other request SHALL be carried out. When that work moves the branch or the change, the chat SHALL run `step` again and follow Act.

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

#### Scenario: An answer to a printed dialog continues

- **WHEN** the next message answers entries of a printed `dialog`
- **THEN** the chat records each answer with that entry's `record` and the person's words unchanged, does not edit the change, and runs `step`

#### Scenario: A question about the cycle runs step

- **WHEN** the next message only asks where the cycle is
- **THEN** the chat runs `step` again, follows Act, and does not describe the cycle from an earlier print

#### Scenario: Another request is carried out

- **WHEN** the next message asks for other work
- **THEN** the chat carries out that request, and runs `step` again when the work moves the branch or the change
