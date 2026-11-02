## ADDED Requirements

### Requirement: The home block has its own agent field

The home block SHALL show an agent field above the models. That field SHALL be empty until an agent is saved. The new-role form SHALL NOT have the field that writes the home agent.

#### Scenario: Nothing saved leaves the field empty

- **WHEN** the home file has no agent and the manager opens settings
- **THEN** the home block shows an empty agent field above the models

#### Scenario: The new-role form does not write the home agent

- **WHEN** the manager opens the new-role form under Roles
- **THEN** that form has no field that writes the home agent

#### Scenario: A saved agent shows in the field

- **WHEN** the home file names an agent and the manager opens settings
- **THEN** the home block's agent field shows that agent, above the models

### Requirement: Choosing an agent writes the home file at once

Choosing an agent in the home block's agent field SHALL write the home file at once with that agent's known pair. Choosing the agent the home file already records SHALL leave the home file unchanged.

#### Scenario: Choosing cursor writes the known pair

- **WHEN** the home block's agent field is empty and the manager chooses `cursor`
- **THEN** the home file records `cursor` and cursor's known pair at once

#### Scenario: Choosing another agent writes that pair

- **WHEN** the home file records one agent and the manager chooses a different agent in the home block
- **THEN** the home file records the new agent and that agent's known pair

#### Scenario: Choosing the saved agent again changes nothing

- **WHEN** the home file records an agent and the manager chooses that same agent again
- **THEN** the home file is unchanged

### Requirement: The row, the lamp, and Take read the home agent

The row `фабрике ещё нужен агент`, the lamp, and Take SHALL read the agent in the home file. An agent named only by `агент слоя` SHALL NOT satisfy that read.

#### Scenario: No home agent leaves the factory row

- **WHEN** the home file names no agent
- **THEN** the board shows `фабрике ещё нужен агент`, and the lamp and Take read no agent from the home file

#### Scenario: A home agent turns the board on

- **WHEN** the home file names an agent
- **THEN** the board does not show `фабрике ещё нужен агент`, and the lamp and Take read that agent

#### Scenario: The layer agent leaves the factory row

- **WHEN** the home file names no agent and `агент слоя` names an agent
- **THEN** the board still shows `фабрике ещё нужен агент`

### Requirement: The layer agent stays a checkout override

`агент слоя` SHALL remain the override for that one checkout. An empty `агент слоя` SHALL mean the home agent. The overlay models, effort, and speed SHALL keep following the merged factory. The checkout overlay SHALL stay out of the repository.

#### Scenario: An empty layer agent means the home agent

- **WHEN** the home file names an agent and `агент слоя` for a checkout is empty
- **THEN** that checkout uses the home agent

#### Scenario: A layer choice writes the overlay only

- **WHEN** the manager chooses an agent in `агент слоя`
- **THEN** that checkout's overlay records the agent, the home file is unchanged, and the overlay stays out of the repository

#### Scenario: The home agent leaves overlay models on the merged factory

- **WHEN** a checkout overlay names models, effort, or speed and the manager chooses an agent in the home block
- **THEN** those overlay models, effort, and speed still follow the merged factory
