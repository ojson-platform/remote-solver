## RENAMED Requirements

- FROM: `### Requirement: The home agent control is the first field of the new-role form`
- TO: `### Requirement: The home block has its own agent field above the models`
- FROM: `### Requirement: While nothing is saved the list shows cursor`
- TO: `### Requirement: The field is empty until an agent is saved`

## MODIFIED Requirements

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
