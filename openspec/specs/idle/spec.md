# idle

## Purpose

A skill run that changes nothing is not started again until the decision changes.

## Requirements

### Requirement: A run with no commit is not repeated

When a skill run produces no commit, the spy SHALL NOT start that issue again while the phase, the action, and the reason are unchanged. The idle notice SHALL be reported once. A different phase, action, or reason SHALL start. An exit other than the no-commit exit SHALL clear the idle mark, so the same decision MAY start again.

#### Scenario: The same decision stays idle

- **WHEN** a run produces no commit and the next poll has the same phase, action, and reason
- **THEN** the spy does not start the issue again and reports the idle once
- **AND** the following poll reports nothing further

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
