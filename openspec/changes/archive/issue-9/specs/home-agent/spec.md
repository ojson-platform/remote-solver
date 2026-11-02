## RENAMED Requirements

- FROM: `### Requirement: The home agent select is on the new-role form`
- TO: `### Requirement: The home agent field is on the home block`
- FROM: `### Requirement: Sending the new-role form writes the known pair`
- TO: `### Requirement: Choosing an agent writes the known pair`

## MODIFIED Requirements

### Requirement: The home agent field is on the home block

The home block SHALL show its own agent field above the models, and SHALL show the models, the watch list, and the roots. The new-role form SHALL NOT have that agent field. The field SHALL be empty until an agent is saved.

#### Scenario: The home block has its own agent field above the models

- **WHEN** the manager opens settings
- **THEN** the home block has its own agent field above the models, the home block shows the models, the watch list, and the roots, and the new-role form does not have that field

#### Scenario: The field is empty until an agent is saved

- **WHEN** no agent is saved
- **THEN** the home block's agent field is empty

### Requirement: Choosing an agent writes the known pair

Choosing an agent SHALL write the home file at once with that agent and that agent's known pair. Choosing that saved agent again SHALL change nothing.

#### Scenario: Choosing an agent writes the home file at once

- **WHEN** the manager chooses an agent that is not the agent already saved
- **THEN** the home file is written at once with that agent and that agent's known pair

#### Scenario: Choosing the saved agent again changes nothing

- **WHEN** the home file already has an agent and the manager chooses that saved agent again
- **THEN** the home file is unchanged

## ADDED Requirements

### Requirement: The checkout overlay stays an override of the home agent

`агент слоя` SHALL remain the override for that one checkout. An empty `агент слоя` SHALL mean the home agent. The overlay models, effort, and speed SHALL keep following the merged factory. The checkout overlay SHALL stay out of the repository.

#### Scenario: агент слоя remains the override for that one checkout

- **WHEN** that checkout has `агент слоя` set and the manager saves a home agent
- **THEN** `агент слоя` remains the override for that one checkout

#### Scenario: Empty means the home agent

- **WHEN** `агент слоя` is empty and the home file has an agent
- **THEN** the empty `агент слоя` means the home agent for that checkout

#### Scenario: The overlay models, effort, and speed follow the merged factory

- **WHEN** the manager chooses a home agent
- **THEN** the overlay models still follow the merged factory, the overlay effort still follows the merged factory, and the overlay speed still follows the merged factory

#### Scenario: The checkout overlay stays out of the repository

- **WHEN** the manager chooses a home agent and the checkout has an overlay
- **THEN** the checkout overlay stays out of the repository
