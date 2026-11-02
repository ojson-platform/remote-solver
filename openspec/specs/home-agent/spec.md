# home-agent

## Purpose

The home agent is the agent stored in the home file. The control that writes it sits on the new-role form. The layer agent writes only that checkout's overlay, and an empty layer agent means the home agent.

## Requirements

### Requirement: The home agent control is the first field of the new-role form

The home block SHALL show the models, then effort and speed when that agent has them, then the watch list, and then the roots. It SHALL NOT show an agent field above the models. Under Roles, the new-role form SHALL start with a select labeled `агент` and SHALL also carry the new role's name, outcome, and text. A change in that form SHALL submit it. The submission SHALL write the home agent when it names one. A filled role name on that submission SHALL be stored with it. An empty role name SHALL store no role.

#### Scenario: The agent select is the first field of the new-role form

- **WHEN** the manager opens settings and the home file has no agent
- **THEN** the home block shows the models, the watch list, and the roots, with no agent field above the models, and the new-role form's first field is labeled `агент`

#### Scenario: A filled name is stored with the agent

- **WHEN** the new-role form is submitted with an agent and a role name
- **THEN** the home file records that agent and that role

#### Scenario: An empty name stores no role

- **WHEN** the new-role form is submitted with an agent and an empty role name
- **THEN** the home file records that agent and gains no role

### Requirement: While nothing is saved the list shows cursor

The home agent select SHALL offer no empty choice, and its first choice SHALL be `cursor`. While the home file has no agent, the field SHALL show `cursor` and the saved agent SHALL stay empty. Choosing that shown `cursor` SHALL NOT submit, and the home file SHALL stay without an agent.

#### Scenario: Choosing the shown cursor does not write

- **WHEN** the home file has no agent and the manager chooses the shown `cursor`
- **THEN** the form does not submit and the home file still has no agent

### Requirement: A submitted agent writes the known pair at once

A submission that names an offered agent SHALL write the home file at once with that agent and that agent's known pair. Naming the agent that is already saved SHALL replace that set with the known pair again, including a model the manager had changed. The field SHALL NOT submit a choice that did not change, so choosing the saved agent again from the field SHALL leave the file as it is.

#### Scenario: Changing the shown cursor to codex writes the pair

- **WHEN** the home file has no agent and the manager changes the choice from the shown `cursor` to `codex`
- **THEN** the home file records `codex`, `gpt-6-luna`, and `gpt-6.1-sol`

#### Scenario: Submitting the saved agent replaces a changed model

- **WHEN** the saved agent is `cursor`, one model has been changed, and `cursor` is submitted again
- **THEN** the home file records `composer-2.5-fast` and `grok-4.7-high-fast`

#### Scenario: Choosing the saved agent from the field leaves the file

- **WHEN** the saved agent is `cursor` and the manager chooses the shown `cursor`
- **THEN** the home file is unchanged

### Requirement: The layer agent does not record a home agent

The select labeled `агент слоя` SHALL write the checkout overlay and SHALL NOT write the home agent. When the overlay has no agent of its own, the field SHALL show the home agent, and an empty home agent SHALL show the empty choice. While the home file has no agent, the row SHALL stay `фабрике ещё нужен агент`, the lamp SHALL stay off, and «Взять» SHALL NOT act, including after an overlay agent is chosen.

#### Scenario: An overlay agent leaves the board asking for an agent

- **WHEN** the home file has no agent and the manager chooses `codex` on `агент слоя`
- **THEN** the overlay records `codex` and the board row stays `фабрике ещё нужен агент`

#### Scenario: An empty overlay agent shows the home agent

- **WHEN** the home agent is `cursor` and the overlay has no agent of its own
- **THEN** the layer field shows `cursor`
