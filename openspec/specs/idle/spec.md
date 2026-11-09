# idle

## Purpose

A skill run that changes nothing is not started again until the decision changes.

## Requirements

### Requirement: A run with no commit is not repeated

When a skill run produces no commit, the machine SHALL comment `sdd:refused` and that effect's signature on the issue. The next poll SHALL NOT start that effect while the refusal is the latest machine comment and the phase, the action, and the reason are unchanged. A later person comment SHALL clear the refusal. A different phase, action, or reason SHALL start. The spy SHALL NOT keep the mark in its own memory. An exit other than the no-commit exit SHALL NOT post the refusal, so the same decision MAY start again. When one worker runs a later turn and that turn produces no commit, the refusal SHALL name that later turn.

#### Scenario: A later turn with no commit stays idle

- **WHEN** one worker's first turn commits and its next turn does not
- **THEN** the spy does not start that later turn again

#### Scenario: The same decision stays idle

- **WHEN** a run produces no commit and the next poll has the same phase, action, and reason
- **THEN** the issue carries `sdd:refused` and the spy does not start the issue

#### Scenario: A person comment starts the effect again

- **WHEN** a person comments after `sdd:refused`
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

A skill run that crashes before a commit SHALL leave its chat and SHALL NOT post `sdd:refused`. The next start of that same decision SHALL resume that chat. A second crash of that chat SHALL post `sdd:refused` and SHALL NOT start an agent. A run that commits and a different decision SHALL each start a new chat. A run that finishes with no commit SHALL NOT start again until a person comments.

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
