# marker

## Purpose

The latest marker on a review thread or the pull-request conversation tells the machine which layer the work belongs to.

## Requirements

### Requirement: One body carries one marker

In one reply, `fixed` SHALL win, then `note`, then a lowercase `layer`, then `begin`. Anything else SHALL be no marker. A layer value that is not lowercase SHALL be no marker.

#### Scenario: Fixed wins over a layer in the same reply

- **WHEN** a reply contains both `fixed` and a layer
- **THEN** the marker is `fixed`

#### Scenario: A capitalised layer is no marker

- **WHEN** a reply contains `layer` with a value that is not all lowercase
- **THEN** the marker is nothing

### Requirement: An unmarked remark is classified before the phase moves

An open thread with no marker SHALL be classified before a rollback or a phase skill. The last conversation comment SHALL be unanswered when a person wrote it and it carries no marker. A robot comment, or any marker, SHALL leave the conversation answered. A resolved thread SHALL NOT count. A thread whose latest reply is `fixed` SHALL NOT be unanswered, SHALL NOT name a layer, and SHALL NOT appear as unmarked.

#### Scenario: An unlabeled thread is classified during implementing

- **WHEN** the phase is `implementing` and an open thread has no marker
- **THEN** the machine classifies the thread and does not run the implementation skill

#### Scenario: A fixed thread is done

- **WHEN** an open thread's latest reply is `fixed`
- **THEN** the thread is not unanswered, names no layer, and is excluded from the unmarked list

#### Scenario: An unanswered conversation on accepting is classified before the merge

- **WHEN** the phase is `accepting`, the change is archived, the checks are green, and the last conversation comment is a person's and carries no marker
- **THEN** the machine classifies that comment and does not wait for the merge

### Requirement: The robot mark and an ignored author are not a person

A body that starts with the robot mark SHALL be the robot. An author on the ignore list SHALL be the robot. A login that contains `[bot]` SHALL be a person unless that author is ignored.

#### Scenario: The robot mark and an ignored author leave the conversation answered

- **WHEN** the last conversation comment starts with the robot mark, or its author is on the ignore list
- **THEN** the conversation is not unanswered

#### Scenario: A bot login that is not ignored stays unanswered

- **WHEN** the last conversation comment is from a login that contains `[bot]` and is not on the ignore list, and the body has no marker
- **THEN** the conversation is unanswered

### Requirement: The earliest layer rolls the phase back

Among open threads and the conversation, the earliest of `proposal`, `spec`, `design`, `tasks`, and `code` SHALL move the phase there when that phase is earlier than the current one. `out`, `note`, `fixed`, and `begin` SHALL NOT move the phase. On `verifying` this rollback SHALL wait until the checks rule runs. A later `fixed` in the conversation SHALL clear its layer. A later layer SHALL replace it.

#### Scenario: A spec marker during implementing moves to specifying

- **WHEN** the phase is `implementing` and an open thread marks `spec`
- **THEN** the machine moves the issue to `specifying`

#### Scenario: Out does not move the phase

- **WHEN** the phase is `implementing` and the only markers are `out` and `code`
- **THEN** the phase stays `implementing` and the machine fixes the code thread

#### Scenario: The earliest of two layers wins

- **WHEN** open threads mark both `code` and `spec`
- **THEN** the rollback phase is `specifying`

#### Scenario: A later fixed clears the conversation layer

- **WHEN** the phase is `accepting`, the change is archived, the checks are green, and the conversation marks `code` and then `fixed`
- **THEN** the machine does not move the issue to `implementing`

### Requirement: Thread fix closes a thread in one call

`thread fix` SHALL refuse while HEAD is not the tip of the remote issue branch. Otherwise it SHALL reply `fixed` with that HEAD and resolve the thread in the same call. A thread that is already `fixed` and still open SHALL only be resolved. A resolved thread SHALL be left unchanged. The conversation form SHALL post that same line to the conversation.

#### Scenario: Fix refuses before the commit is on the remote branch

- **WHEN** `thread fix` runs and HEAD is not on the remote issue branch
- **THEN** the command fails and the thread stays open

#### Scenario: Fix replies and resolves together

- **WHEN** `thread fix` runs for an open thread and HEAD is on the remote issue branch
- **THEN** the thread's reply is `fixed` with that HEAD and the thread is resolved
