# idle

## Purpose

A skill run that changes nothing is not started again until the decision changes. A run that leaves a marker or a dirty worktree is not that case.

## Requirements

### Requirement: A run with no commit is not repeated

A clean run with no commit and no new marker SHALL comment `sdd:refused` with the effect's phase, action, and reason, and SHALL set that label. The comment SHALL NOT contain a null byte.

The next poll SHALL NOT start that effect while the label matches it. Removing the label SHALL let it start. A person comment SHALL NOT remove the label. A different phase, action, or reason SHALL start. The spy SHALL NOT remember the mark.

#### Scenario: A later turn with no commit stays idle

An exit other than the no-commit exit SHALL NOT post the refusal, so the same decision MAY start again.

When one worker runs a later turn and that turn produces no commit, the refusal SHALL name that later turn.

- **WHEN** one worker's first turn commits and its next turn does not
- **THEN** the spy does not start that later turn again

#### Scenario: The same decision stays idle

- **WHEN** a run produces no commit and the next poll has the same phase, action, and reason
- **THEN** the issue carries the label `sdd:refused` and a comment with the phase, the action, and the reason, the comment has no null byte, and the spy does not start the issue

#### Scenario: A person comment leaves the refusal

- **WHEN** a person comments after `sdd:refused`
- **THEN** the same effect does not start

#### Scenario: Removing the label starts the effect again

- **WHEN** the label `sdd:refused` is removed
- **THEN** the same effect starts

#### Scenario: A different action starts

- **WHEN** a run has finished and the next decision is a different action
- **THEN** the spy starts that action

### Requirement: A running issue and the parallel cap are left alone

The spy SHALL NOT settle or start an issue whose worker is still running. It SHALL start at most the parallel cap at once. The default cap SHALL be 2.

#### Scenario: A running issue is not moved

- **WHEN** a worker is still running for an issue
- **THEN** the spy does not change that issue's labels and does not start it again

#### Scenario: Parallel 1 starts one of two ready issues

- **WHEN** two issues are ready to start and the cap is 1
- **THEN** the spy starts one of them

### Requirement: Another process does not start a held issue

A second process SHALL NOT start an agent for an issue a live process already holds. It SHALL NOT mark that decision idle. A hold whose process is gone SHALL be taken by the next drive.

#### Scenario: A held issue does not start an agent

- **WHEN** another process already holds the issue
- **THEN** a drive of that issue does not start an agent

#### Scenario: A dead holder releases the issue

- **WHEN** the process recorded in the hold is gone
- **THEN** the next drive takes the hold

### Requirement: A crashed run resumes its chat once

A skill run that crashes before a commit SHALL leave its chat and SHALL NOT post `sdd:refused`. The next start of that same decision SHALL resume that chat. A second crash of that chat SHALL post `sdd:refused` and SHALL NOT start an agent. A run that commits and a different decision SHALL each start a new chat. A clean run with no commit and no new marker SHALL NOT start again until `sdd:refused` is removed.

#### Scenario: A crash resumes the same chat

- **WHEN** a skill run crashes before it commits
- **THEN** the next start of that same decision resumes that chat

#### Scenario: A second crash stays idle

- **WHEN** the resumed chat crashes as well
- **THEN** the issue carries `sdd:refused` and the next drive does not start an agent

#### Scenario: A commit starts a new chat

- **WHEN** a skill run commits
- **THEN** the next start of the same action begins a new chat

#### Scenario: A run with no commit does not start again

- **WHEN** a skill run finishes with no commit
- **THEN** the next drive does not start an agent

#### Scenario: A different decision starts a new chat

- **WHEN** a chat is recorded for one decision and the next decision is different
- **THEN** that run begins a new chat

### Requirement: A changed run is not idle

When a skill run produces no commit and the issue worktree has uncommitted paths, the machine SHALL NOT post `sdd:refused`, and the next drive SHALL start that effect. When a skill run produces no commit and leaves a new layer marker, the machine SHALL NOT post `sdd:refused`. When a clean run refuses `implement-next-task` and an open task id is known, the reason SHALL include that id.

#### Scenario: A dirty worktree does not refuse the open task

- **WHEN** the run edits the issue worktree and commits nothing
- **THEN** the issue has no `sdd:refused` and the next drive starts the agent again

#### Scenario: A layer marker does not refuse the run

- **WHEN** the run opens a layer thread and commits nothing
- **THEN** the issue has no `sdd:refused`

#### Scenario: The refusal names the open task

- **WHEN** the open task id is `one` and the run commits nothing on a clean worktree
- **THEN** the refusal contains `next open task one`
