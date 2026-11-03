# parallel-cap

## Purpose

A spy poll starts at most its parallel cap of agents. A ready cycle past that cap does not start while running workers fill the cap.

## Requirements

### Requirement: A poll starts at most the cap

A spy poll SHALL start an agent for at most the parallel cap of ready cycles. A worker already running SHALL count toward that cap. A ready cycle past the cap SHALL NOT start on that poll, and SHALL NOT start on a later poll while running workers still fill the cap. While the cap has room, the poll SHALL start another ready cycle, and it SHALL stop once the cap is full.

#### Scenario: A cap of 2 starts two of three

- **WHEN** no worker is running, the cap is 2, and a poll finds three ready cycles
- **THEN** that poll starts two agents and does not start the third

#### Scenario: Running workers fill the cap

- **WHEN** two workers are already running, the cap is 2, and another cycle is ready
- **THEN** a poll starts no agent

#### Scenario: One free slot starts one ready cycle

- **WHEN** one worker is running, the cap is 2, and two cycles are ready
- **THEN** that poll starts one agent and does not start the other

### Requirement: The board runs its spy at a cap of 20

`remote-solver board` SHALL run its spy with a parallel cap of 20. A poll that finds twenty ready cycles SHALL start twenty agents. The twenty-first ready cycle SHALL wait until one of those workers leaves.

#### Scenario: The board runs its spy with a parallel cap of 20

- **WHEN** `remote-solver board` runs its spy and a parallel cap of 20 is already visible, together with the twenty-first ready cycle that waits until one of those workers leaves
- **THEN** `remote-solver board` runs its spy with a parallel cap of 20

#### Scenario: A poll that finds twenty ready cycles starts twenty agents

- **WHEN** no worker is running, a poll finds twenty ready cycles already visible, together with a parallel cap of 20 that can hold back a twenty-first ready cycle until one worker leaves
- **THEN** that poll starts twenty agents

#### Scenario: The twenty-first waits until one of those workers leaves

- **WHEN** the twenty-first ready cycle is already visible, together with a parallel cap of 20 filled by twenty workers, which holds that cycle until one of those workers leaves
- **THEN** the twenty-first waits until one of those workers leaves

### Requirement: The spy command defaults to 2 and honors --parallel

`remote-solver spy` with no `--parallel` SHALL use a parallel cap of 2. `--parallel` followed by a positive whole number SHALL make that number the cap.

#### Scenario: No flag uses a cap of 2

- **WHEN** `remote-solver spy` is run with no `--parallel` and a poll finds three ready cycles and no worker is running
- **THEN** that poll starts two agents

#### Scenario: A positive --parallel is the cap

- **WHEN** `remote-solver spy --parallel 1` polls two ready cycles and no worker is running
- **THEN** that poll starts one agent

#### Scenario: The spy keeps the default cap of 2 and honors --parallel

- **WHEN** `remote-solver spy` already shows a default cap of 2, together with `--parallel` as the limit that can replace that cap
- **THEN** the default cap is 2 and `--parallel` is honored
