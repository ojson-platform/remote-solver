# home-agent

## Purpose

The home agent is the agent stored in the home file. The control that writes it sits on the new-role form. The layer agent writes only that checkout's overlay, and an empty layer agent means the home agent.

## Requirements

### Requirement: The home block has its own agent field above the models

The home block SHALL show an agent field labeled `агент` above the models, then the models, then effort and speed when that agent has them, then the watch list, and then the roots. Under Roles, the new-role form SHALL carry the new role's name, outcome, and text, and SHALL NOT contain the home agent field. A submission of that form SHALL NOT write the home agent. A filled role name SHALL be stored. An empty role name SHALL store no role.

#### Scenario: The agent field sits above the models

- **WHEN** the manager opens settings and the home file has no agent
- **THEN** the home block shows a field labeled `агент` above the models, then the models, the watch list, and the roots, and the new-role form has no field labeled `агент`

#### Scenario: A filled name stores the role and not an agent

- **WHEN** the new-role form is submitted with a role name and the home file has no agent
- **THEN** the home file stores that role and still has no agent

#### Scenario: An empty name stores no role

- **WHEN** the new-role form is submitted with an empty role name
- **THEN** the home file gains no role

### Requirement: The field is empty until an agent is saved

The home agent field SHALL be empty until an agent is saved. While the home file has no agent, the field SHALL show no chosen agent, and it SHALL NOT show `cursor` as already chosen. Once an agent is saved, the field SHALL show that agent.

#### Scenario: Nothing saved leaves the field empty

- **WHEN** the manager opens settings and the home file has no agent
- **THEN** the home agent field shows no chosen agent

#### Scenario: A saved agent is shown

- **WHEN** the home file has saved `cursor` and the manager opens settings
- **THEN** the home agent field shows `cursor`

### Requirement: A submitted agent writes the known pair at once

Choosing an offered agent SHALL write the home file at once with that agent and that agent's known pair. Choosing the agent that is already saved SHALL leave the file as it is, including a model the manager had changed.

#### Scenario: Choosing cursor from an empty field writes the pair

- **WHEN** the home file has no agent and the manager chooses `cursor`
- **THEN** the home file records `cursor`, `composer-2.5-fast`, and `grok-4.7-high-fast`

#### Scenario: Choosing codex writes the pair

- **WHEN** the home file has no agent and the manager chooses `codex`
- **THEN** the home file records `codex`, `gpt-6-luna`, and `gpt-6.1-sol`

#### Scenario: Choosing the saved agent again changes nothing

- **WHEN** the saved agent is `cursor`, one model has been changed, and the manager chooses the shown `cursor`
- **THEN** the home file is unchanged

### Requirement: The layer agent does not record a home agent

The select labeled `агент слоя` SHALL write the checkout overlay and SHALL NOT write the home agent. When the overlay has no agent of its own, the field SHALL show the home agent, and an empty home agent SHALL show the empty choice. While the home file has no agent, the row SHALL stay `фабрике ещё нужен агент`, the lamp SHALL stay off, and «Взять» SHALL NOT act, including after an overlay agent is chosen.

#### Scenario: An overlay agent leaves the board asking for an agent

- **WHEN** the home file has no agent and the manager chooses `codex` on `агент слоя`
- **THEN** the overlay records `codex` and the board row stays `фабрике ещё нужен агент`

#### Scenario: An empty overlay agent shows the home agent

- **WHEN** the home agent is `cursor` and the overlay has no agent of its own
- **THEN** the layer field shows `cursor`
