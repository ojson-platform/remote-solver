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

### Requirement: The board runs its spy at a cap of 2

`remote-solver board` SHALL run its spy with a parallel cap of 2.

#### Scenario: The board starts two of three ready cycles

- **WHEN** `remote-solver board` polls three ready cycles and no worker is running
- **THEN** that poll starts two agents and does not start the third

### Requirement: The spy command defaults to 2 and honors --parallel

`remote-solver spy` with no `--parallel` SHALL use a parallel cap of 2. `--parallel` followed by a positive whole number SHALL make that number the cap.

#### Scenario: No flag uses a cap of 2

- **WHEN** `remote-solver spy` is run with no `--parallel` and a poll finds three ready cycles and no worker is running
- **THEN** that poll starts two agents

#### Scenario: A positive --parallel is the cap

- **WHEN** `remote-solver spy --parallel 1` polls two ready cycles and no worker is running
- **THEN** that poll starts one agent
