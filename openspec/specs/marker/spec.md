# marker

## Purpose

The latest marker on an open review thread tells the machine which layer the work belongs to. A marker on the pull-request conversation records a request and does not move the phase.

## Requirements

### Requirement: One body carries one marker

In one reply, `fixed` SHALL win, then `note`, then a lowercase `layer`, then `begin`. Anything else SHALL be no marker. A layer value that is not lowercase SHALL be no marker.

#### Scenario: Fixed wins over a layer in the same reply

- **WHEN** a reply contains both `fixed` and a layer
- **THEN** the marker is `fixed`

#### Scenario: A capitalised layer is no marker

- **WHEN** a reply contains `layer` with a value that is not all lowercase
- **THEN** the marker is nothing

### Requirement: The instruction is the first comment

The skill SHALL receive the first non-empty comment on the thread as the instruction. The latest comment SHALL stay the body the marker is read from. The marker SHALL be read from that latest body, not from the instruction.

#### Scenario: The instruction is the first comment and the body stays the latest

- **WHEN** a thread's first comment asks to quote a refusal and its latest comment is the layer marker
- **THEN** the instruction is the first comment, the body is the latest comment, and the marker is that layer

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

### Requirement: A focus record is a focus

A comment whose first line is a focus marker SHALL be a focus, with or without the robot mark. A body that is not a focus record and starts with the robot mark, or whose author is ignored, SHALL be the robot. Any other comment SHALL be a person. Only a person comment SHALL be a manager comment.

#### Scenario: An unmarked focus record is a focus

- **WHEN** the first line is `sdd:focus:code`, the robot mark is absent, and the author is not ignored
- **THEN** the comment is a focus and is not a manager comment

#### Scenario: A plain sentence is a person

- **WHEN** the body has no focus marker and no robot mark, and the author is not ignored
- **THEN** the comment is a person and is a manager comment

#### Scenario: A marked layer is a robot

- **WHEN** the body starts with the robot mark and the first line is not a focus marker
- **THEN** the comment is a robot and is not a manager comment

### Requirement: The earliest layer rolls the phase back

Among open threads, the earliest of `proposal`, `spec`, `design`, `tasks`, and `code` SHALL move the phase there when that phase is earlier than the current one. `out`, `note`, `fixed`, and `begin` SHALL NOT move the phase. On `verifying` this rollback SHALL wait until the checks rule runs.

#### Scenario: A spec marker during implementing moves to specifying

- **WHEN** the phase is `implementing` and an open thread marks `spec`
- **THEN** the machine moves the issue to `specifying`

#### Scenario: Out does not move the phase

- **WHEN** the phase is `implementing` and the only markers are `out` and `code`
- **THEN** the phase stays `implementing` and the machine fixes the code thread

#### Scenario: The earliest of two layers wins

- **WHEN** open threads mark both `code` and `spec`
- **THEN** the rollback phase is `specifying`

### Requirement: A conversation marker does not take the phase

A layer marker that sits only on the pull-request conversation SHALL leave the phase's own decision in place. It SHALL NOT roll the phase back and SHALL NOT start that layer's action. An open thread with that layer SHALL still roll the phase back or start the action. A later `fixed` in the conversation SHALL clear its layer. A later layer SHALL replace it. `note` SHALL NOT name a layer.

#### Scenario: A conversation code marker during implementing leaves the next task

- **WHEN** `implementing` has an open task and the conversation marks `code`
- **THEN** the machine runs the next task

#### Scenario: A conversation code marker with no open task moves on to verifying

- **WHEN** `implementing` has no open task and the conversation marks `code`
- **THEN** the machine moves the issue to `verifying`

#### Scenario: A conversation code marker on accepting does not move to implementing

- **WHEN** the phase is `accepting`, the change is archived, the checks are green, and the conversation marks `code`
- **THEN** the machine waits for the merge

#### Scenario: A later fixed clears the conversation layer

- **WHEN** the phase is `accepting`, the change is archived, the checks are green, and the conversation marks `code` and then `fixed`
- **THEN** the conversation layer is clear and the machine does not move the issue to `implementing`

### Requirement: A classified marker moves before a held review gate

A classified layer marker on an open thread SHALL move the phase, or start the current layer's action, before a held review gate is repeated. An open thread with no marker SHALL still be classified first. An unanswered conversation SHALL be classified before that thread's action. A conversation note, with no layer thread, SHALL leave the gate in place. `wait-human` SHALL keep the gate when no thread carries a layer marker.

#### Scenario: An unlabeled thread during a held design review is classified

- **WHEN** `designing` has `wait-human` and an open thread has no marker
- **THEN** the machine classifies the thread and does not repeat the design gate

#### Scenario: A spec marker during a held design review moves to specifying

- **WHEN** `designing` has `wait-human` and an open thread marks `spec`
- **THEN** the machine moves the issue to `specifying`

#### Scenario: A design marker during a held design review improves the design

- **WHEN** `designing` has `wait-human` and an open thread marks `design`
- **THEN** the machine improves the design and does not repeat the design gate

#### Scenario: A proposal marker during a held proposal review improves the proposal

- **WHEN** `proposing` has `wait-human`, the conversation is answered, and an open thread marks `proposal`
- **THEN** the machine improves the proposal and does not repeat the proposal gate

#### Scenario: A note during a held proposal review keeps the gate

- **WHEN** `proposing` has `wait-human`, the conversation is a note, and no thread carries a layer
- **THEN** the machine repeats the proposal gate

#### Scenario: An unanswered conversation is classified before the proposal thread

- **WHEN** `proposing` has `wait-human`, the last conversation comment is a person's and carries no marker, and an open thread marks `proposal`
- **THEN** the machine classifies that comment and does not improve the proposal

### Requirement: An open item keeps its file's layer

An open thread whose line is an unchecked `- [ ]` item under `## Open decisions` in `design.md` SHALL be the `design` layer.

An open thread whose line is an unchecked `- [ ]` item under `## Open questions` in `proposal.md` SHALL be the `proposal` layer.

The latest reply's marker SHALL NOT replace that layer, except a reply that is `fixed`.

`threads --layer` SHALL list the thread under that layer and SHALL NOT list it as unmarked.

#### Scenario: A spec marker on an open decision stays on design

A thread on any other line, and a thread on a checked item, SHALL keep the marker its reply carries.

`thread fix` SHALL refuse while the thread's line is still that unchecked item.

The thread SHALL stay open.

- **WHEN** `designing` has an unchecked Open decisions item and the open thread on that line marks `spec`
- **THEN** the machine improves the design and does not move the issue to `specifying`, and `threads --layer design` lists that thread

#### Scenario: An unmarked reply on an open decision is design

- **WHEN** an open thread on an unchecked Open decisions line carries no marker
- **THEN** the thread is not unanswered, `threads --layer design` lists it, and the unmarked list does not

#### Scenario: A spec marker on an open question stays on proposal

- **WHEN** `proposing` has an unchecked Open questions item and the open thread on that line marks `spec`
- **THEN** the machine improves the proposal and does not wait on the open question

#### Scenario: A spec marker on another design line moves to specifying

- **WHEN** `designing` has an open thread on a design line that is not an unchecked Open decisions item and the thread marks `spec`
- **THEN** the machine moves the issue to `specifying`

#### Scenario: A checked decision keeps the reply's layer

- **WHEN** an open thread on a checked Open decisions item marks `spec`
- **THEN** the rollback phase is `specifying`

#### Scenario: Fix refuses while the open item is unchecked

- **WHEN** `thread fix` runs, HEAD is on the remote issue branch, and the thread's line is an unchecked Open decisions item
- **THEN** the command fails and the thread stays open

### Requirement: Thread fix closes a thread in one call

`thread fix` SHALL refuse while HEAD is not the tip of the remote issue branch. Otherwise it SHALL reply `fixed` with that HEAD and resolve the thread in the same call. A thread that is already `fixed` and still open SHALL only be resolved. A resolved thread SHALL be left unchanged. The conversation form SHALL post that same line to the conversation.

#### Scenario: Fix refuses before the commit is on the remote branch

- **WHEN** `thread fix` runs and HEAD is not on the remote issue branch
- **THEN** the command fails and the thread stays open

#### Scenario: Fix replies and resolves together

- **WHEN** `thread fix` runs for an open thread and HEAD is on the remote issue branch
- **THEN** the thread's reply is `fixed` with that HEAD and the thread is resolved
