# agent-run

## Purpose

An agent run is the process the solver starts for one skill. The run owns every process that agent starts.

## Requirements

### Requirement: A process left behind by the agent run is killed while the run continues

While an agent run is in progress, the run SHALL remember the processes it started. A remembered process that has left the run's tree SHALL be killed while the run is still in progress. A process that still belongs to the run SHALL keep running.

#### Scenario: A grandchild is killed after its parent exits

- **WHEN** an agent run starts a sleeper under a short-lived parent and the agent keeps running
- **THEN** the sleeper is killed while that run is still in progress
