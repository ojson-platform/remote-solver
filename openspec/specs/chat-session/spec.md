# chat-session

## Purpose

One chat drives one issue until the machine waits or the issue is done. The next message in that chat continues the same issue.

## Requirements

### Requirement: The chat runs until the machine waits

A step that ends in Publish or Hand-off SHALL run `step` again. A printed `advance` SHALL run `step` again. A step that leaves no Publish, no Hand-off, and no Wait SHALL stop. A printed `wait` that carries `dialog` SHALL show those entries together in the client's question dialog and SHALL NOT stop. The chat SHALL say that this phase has open questions and this turn answers them. The printed text SHALL be the question. The prompt SHALL be that text. The chat SHALL write each choice from the printed question and the issue text already in the step. Each whole answer SHALL be its own choice. A choice SHALL be a whole answer the person can accept unchanged. When one whole answer is ready, the second choice SHALL be Skip: it records nothing, the item stays open, and the next run asks it again. One whole answer SHALL be enough: the dialog still opens, and the chat SHALL NOT ask by printing the question alone. A skip SHALL record nothing. Skipping one entry SHALL still run `step`. When every entry was skipped, the chat SHALL stop. The person's own words SHALL stay available. Each answer SHALL be recorded by that entry's `record`, with the person's words unchanged in place of `<answer>`. That command SHALL be the only post. The chat SHALL NOT edit the change. It SHALL then run `step` again. When that command exits non-zero, the chat SHALL stop and name the file and the exit. When the next step still lists an entry the person answered, the chat SHALL stop, say the record did not close it, and SHALL NOT post the answer another way. Closing the dialog SHALL answer nothing and stop. An entry left unanswered SHALL stay open, and the next run SHALL ask it again. When the next step lists only entries the person left unanswered, the chat SHALL stop. A later message that answers these entries SHALL be recorded the same way. A printed `wait` without `dialog`, or `done`, SHALL stop. The printed `step` SHALL carry the issue text, then the upstream block, then the action text with this service's hooks. The chat SHALL follow that text and SHALL NOT open the step file, the program, its adapters, or another skill's scripts. The chat SHALL edit in the path `sdd worktree` prints. Every `sdd` command SHALL run from the service root. The chat SHALL NOT search the tree for that checkout. The chat SHALL NOT rebase, commit, or publish except by the `sdd` command. When `sdd publish` exits non-zero, the chat SHALL stop and name the exit, and SHALL NOT rebase the branch by hand. A repository rule that runs a local check before push SHALL NOT apply in this cycle. Pull-request checks SHALL be read when the phase is verifying.

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
- **THEN** the chat says that this phase has open questions and this turn answers them, shows every entry together in the client's question dialog, treats the printed text as the question, writes each choice from the printed question and the issue text already in the step, makes each whole answer its own choice, offers a choice that is a whole answer the person can accept unchanged, offers Skip as the second choice when one whole answer is ready, still opens the dialog when one whole answer is ready, does not ask by printing the question alone, records nothing for a skip, still runs `step` when one entry is skipped, stops when every entry was skipped, keeps the person's own words available, records each answer by that entry's `record` with the person's words unchanged in place of `<answer>`, posts only by that command, does not edit the change, and runs `step` again
- **AND** closing the dialog answers nothing and stops, an entry left unanswered stays open, and the next run asks it again
- **AND** a command that exits non-zero stops the chat and the message names the file and the exit
- **AND** when the next step still lists an entry the person answered, the chat stops, says the record did not close it, and does not post the answer another way
- **AND** when the next step lists only entries the person left unanswered, the chat stops
- **AND** a later message that answers these entries is recorded the same way

#### Scenario: A wait without a dialog stops the chat

- **WHEN** `step` prints `wait` without `dialog`, or `done`
- **THEN** the chat stops

#### Scenario: The chat follows the printed step

- **WHEN** `step` prints an agent decision
- **THEN** the chat follows that decision's `step` text, does not open the step file, the program, its adapters, or another skill's scripts, edits in the path `sdd worktree` prints, runs every `sdd` command from the service root, stops and names the exit when `sdd publish` exits non-zero, does not rebase the branch by hand, does not run a local check before push, and leaves pull-request checks to verifying

### Requirement: The stop tells the person what happened

The stop message SHALL say what the run finished, why it stopped, and the files that matter for this stop as links. The printed reason SHALL be a fact in that message. The message SHALL NOT reuse a fixed wording.

#### Scenario: The stop names the work, the cause, and the files

- **WHEN** the chat stops
- **THEN** the message says what the run finished, why it stopped, and names the files that matter as links, and the printed reason is a fact in that message rather than the whole message

### Requirement: The next message stays in the session

The next message SHALL continue the same issue. The skill SHALL NOT ask for `/sdd-flow` again. Agreement on a gate SHALL accept and run `step`. Agreement after a stop with no signal SHALL run `step`. A request to change the artifact SHALL publish, unwait, and run `step`. A message that answers a printed `dialog` SHALL follow that dialog's record. A message that only asks where the cycle is SHALL run `step` again and follow Act, and SHALL NOT describe the cycle from an earlier print. Any other request SHALL be carried out. When that work moves the branch or the change, the chat SHALL run `step` again and follow Act.

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
- **THEN** the chat follows that dialog's record

#### Scenario: A question about the cycle runs step

- **WHEN** the next message only asks where the cycle is
- **THEN** the chat runs `step` again, follows Act, and does not describe the cycle from an earlier print

#### Scenario: Another request is carried out

- **WHEN** the next message asks for other work
- **THEN** the chat carries out that request, and runs `step` again when the work moves the branch or the change
