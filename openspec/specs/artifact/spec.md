# artifact

## Purpose

Each writing phase owns one change file. The cycle returns to the phase that still has to write it.

## Requirements

### Requirement: A writing phase publishes its own file

`proposing` owns the proposal, `specifying` the delta, `designing` the design, and `tasking` the tasks. While that file is missing, or no pull request is open, the machine SHALL run the skill that writes and publishes it, and SHALL NOT open the review gate. For specifying, the delta is present when a delta file exists, or when the proposal names no capability. A capability is a line under `### Added` or `### Modified` in `## Capabilities`. A baseline spec under `openspec/specs/` does not make the delta present. When the delta is present that way and no pull request is open, the machine SHALL run the specify skill to publish the change, and the reason SHALL be `publish the change to the pull request`.

#### Scenario: Proposing without a proposal writes one

- **WHEN** the phase is `proposing` and the change has no proposal
- **THEN** the machine runs the plan skill and does not set `wait-human`

#### Scenario: A proposal with no pull request is published

- **WHEN** the phase is `proposing`, the proposal exists, and no pull request is open
- **THEN** the machine runs the plan skill to publish it

#### Scenario: Specifying with a named capability writes the delta

- **WHEN** the phase is `specifying`, the proposal names a capability, the change has no delta file, and one pull request is open
- **THEN** the machine runs the specify skill and does not open the review gate

#### Scenario: Specifying with no named capability opens the review

- **WHEN** the phase is `specifying`, the proposal names no capability, the change has no delta file, and one pull request is open
- **THEN** the machine opens the spec review gate

#### Scenario: Specifying with no named capability and no pull request publishes

- **WHEN** the phase is `specifying`, the proposal names no capability, and no pull request is open
- **THEN** the machine runs the specify skill with the reason `publish the change to the pull request` and does not open the review gate

### Requirement: A missing earlier file returns one phase

`specifying` SHALL return to `proposing` when the proposal is missing. `designing` SHALL return to `specifying` when a named capability has no delta file. When the proposal names no capability, `designing` SHALL NOT return to `specifying` for a missing delta file. `tasking` SHALL return to `designing` when the design is missing. `implementing` SHALL return to `tasking` when the tasks are missing. Each check looks only at the previous phase's file. Specifying is ready without a delta file when the proposal names no capability.

#### Scenario: Specifying without a proposal returns to proposing

- **WHEN** the phase is `specifying` and the change has no proposal
- **THEN** the machine moves the issue to `proposing`

#### Scenario: Designing with a delta and no proposal stays

- **WHEN** the phase is `designing` and the delta exists
- **THEN** the machine does not move the issue to `proposing` because the proposal is absent

#### Scenario: Designing without a delta returns to specifying

- **WHEN** the phase is `designing`, the proposal names a capability, and the change has no delta file
- **THEN** the machine moves the issue to `specifying`

#### Scenario: Designing with no named capability stays without a delta

- **WHEN** the phase is `designing`, the proposal names no capability, the design exists, one pull request is open, and the change has no delta file
- **THEN** the machine does not move the issue to `specifying` and opens the design review gate

### Requirement: Open items hold only their own file

An unchecked item under Open questions SHALL hold `proposing`, including when `auto-plan` is set. An unchecked item under Open decisions SHALL hold `designing`, including when `auto-design` is set. A review thread on an unchecked Open questions line SHALL stay on `proposing`. A review thread on an unchecked Open decisions line SHALL stay on `designing`. `specifying` SHALL NOT hold for an unchecked item in the delta.

#### Scenario: Open questions hold proposing under auto-plan

- **WHEN** `proposing` has a published proposal, two open questions, and `auto-plan`
- **THEN** the machine waits and does not move to `specifying`

#### Scenario: An open task stays in implementing

- **WHEN** `implementing` has a tasks file with an unchecked task
- **THEN** the machine runs the next task and does not move to `verifying`

### Requirement: The writing prompt carries the issue text

The prompt for a skill run SHALL include the issue title and body. It SHALL say that this text is the whole description, and SHALL tell the run not to search the repository for the issue and not to read the service source to recover it. An empty title SHALL stay empty. An empty body SHALL stay empty, and the prompt SHALL say the issue has no description. Surrounding whitespace SHALL NOT count as a title or a body.

#### Scenario: The prompt includes the issue and forbids a search

- **WHEN** the machine runs a skill for an issue that has a title and a body
- **THEN** the prompt contains that title, that body, and the instruction not to search the repository or read the service source for the issue

#### Scenario: An empty issue stays empty

- **WHEN** the machine runs a skill for an issue with an empty title and an empty body
- **THEN** the prompt includes that empty title and that empty body, says the issue has no description, and still tells the run not to search

### Requirement: The writing prompt carries the input revision

For `specify`, `design`, and `tasks`, the prompt SHALL carry the current text of the previous artifact and the `sdd-absorbed` stamp in this step's file. A stamp that equals the revision of that text SHALL be one sentence and SHALL NOT include the text. For `tasks`, that prompt SHALL also name the delta revision on its own line. A missing file SHALL say that file does not exist yet. `plan` SHALL be told that the issue text is the upstream and that the proposal existing is not a reason to leave it. Any other skill SHALL be told that the action has no previous artifact. An unreadable previous artifact SHALL tell the run not to treat the existing file as already right. The revision SHALL be a hash of the current bytes. The prompt SHALL NOT be a diff against a commit.

#### Scenario: A design run after a spec edit carries that text

- **WHEN** `design.md` has no stamp and the delta spec states a fact
- **THEN** the design prompt contains that fact, names the input revision, and does not say the stamp matches

#### Scenario: A design run whose stamp matches says so in one sentence

- **WHEN** `design.md` records `sdd-absorbed` equal to the revision of the delta spec
- **THEN** the design prompt says the stamp matches the input revision and does not include the spec text

#### Scenario: A design run before design.md exists says the file does not exist yet

- **WHEN** the checkout has no `design.md`
- **THEN** the design prompt says `design.md` does not exist yet

#### Scenario: A plan run says the issue text is the upstream

- **WHEN** the machine runs `plan`
- **THEN** the prompt says the issue text is the upstream of `proposal.md` and that the file existing is not a reason to leave it

#### Scenario: A code run says the action has no previous artifact

- **WHEN** the machine runs `implement`
- **THEN** the prompt says this action has no previous artifact

#### Scenario: A run whose previous artifact cannot be read does not treat the file as already right

- **WHEN** the machine runs `design` and `design.md` is not a file
- **THEN** the prompt says the previous artifact could not be read and not to treat the existing file as already right

#### Scenario: A tasks run whose stamp matches names the delta revision

- **WHEN** `tasks.md` records `sdd-absorbed` equal to the revision of the delta and the design, and the delta states a fact
- **THEN** the tasks prompt says the stamp matches, names the delta revision, and does not include that fact

### Requirement: A stale stamp restarts the writing skill

On `specifying`, when a delta exists and its stamp is not the proposal revision, the machine SHALL run the spec skill before the review gate and before `sdd:auto-spec`. On `designing`, an open decision SHALL wait before that check. When `design.md` exists, no decision is open, and its stamp is not the spec revision, the machine SHALL run the design skill before the review gate and before `sdd:auto-design`. On `tasking`, when `tasks.md` exists and its stamp is not the revision of the specs and the design, the machine SHALL run the tasks skill before it leaves for implementing. A commit of a phase file that leaves `sdd-absorbed` unchanged SHALL restart that skill even when the stamp equals the input revision. A matching stamp on an unchanged file SHALL leave the gate or the advance in place. `sdd accept` SHALL refuse while the stamp of that phase is behind.

#### Scenario: A stale spec stamp restarts specify before the auto advance

- **WHEN** the phase is `specifying`, `sdd:auto-spec` is set, and the delta stamp is not the proposal revision
- **THEN** the machine runs the spec skill and does not advance

#### Scenario: A matching spec stamp still opens the gate

- **WHEN** the phase is `specifying` and the delta stamp equals the proposal revision
- **THEN** the machine opens the review gate

#### Scenario: A phase file edited without moving the stamp restarts the skill

- **WHEN** `design.md` differs from its parent commit, its `sdd-absorbed` line is unchanged, and that stamp equals the spec revision
- **THEN** the machine runs the design skill

#### Scenario: A stale design stamp restarts design before the auto advance

- **WHEN** the phase is `designing`, `sdd:auto-design` is set, no decision is open, and the design stamp is not the spec revision
- **THEN** the machine runs the design skill and does not advance

#### Scenario: A stale tasks stamp restarts tasks before implementing

- **WHEN** the phase is `tasking` and the tasks stamp is not the revision of the specs and the design
- **THEN** the machine runs the tasks skill and does not advance

#### Scenario: An open decision waits before a stale design stamp

- **WHEN** the phase is `designing`, a decision is open, and the design stamp is not the spec revision
- **THEN** the machine waits on the open decision

#### Scenario: Accept refuses a stale spec stamp

- **WHEN** a person accepts `specifying` and the delta stamp is not the proposal revision
- **THEN** the machine refuses

### Requirement: A task card names the delta it was cut from

A task card SHALL name scenario titles and the delta revision `sdd-delta`, and SHALL NOT copy the scenario text. On `implementing`, when that revision is not the live delta, or a live scenario has no card, the machine SHALL return to `tasking` and SHALL NOT run the implement skill. On `implementing`, when every task line is checked and a delta scenario has no open or checked line, the machine SHALL return to `tasking` and SHALL NOT move to `verifying`. On `accepting`, that missing line SHALL make the machine wait and SHALL NOT archive the change. A checked line SHALL count as the scenario's task. Zero open lines SHALL NOT by itself make the cut complete.

#### Scenario: A differing card revision returns implementing to tasking

- **WHEN** `implementing` has an open task and the card revision is not the live delta
- **THEN** the machine returns to `tasking` and does not run the implement skill

#### Scenario: A live scenario with no card returns implementing to tasking

- **WHEN** `implementing` has an open task, the card revision matches, and a delta scenario is named on no card
- **THEN** the machine returns to `tasking` and does not run the implement skill

#### Scenario: A matching card still runs the open task

- **WHEN** `implementing` has an open task, the card revision matches, and the card names every delta scenario
- **THEN** the machine runs the implement skill

#### Scenario: A checked-off cut with an unsliced scenario returns to tasking

- **WHEN** `implementing` has no open task and a delta scenario has no task line
- **THEN** the machine returns to `tasking` and does not move to `verifying`

#### Scenario: Accepting waits while a delta scenario has no task

- **WHEN** `accepting` is not archived and a delta scenario has no open or checked task line
- **THEN** the machine waits and does not archive the change

#### Scenario: A task card records the delta revision and the scenario title

- **WHEN** a card lists a scenario title and `sdd-delta`, and `tasks.md` checks that title
- **THEN** the machine reads that title, that revision, and that checked line

#### Scenario: A checked task line lets accepting archive

- **WHEN** `accepting` is not archived and every delta scenario has a checked task line
- **THEN** the machine archives the change
