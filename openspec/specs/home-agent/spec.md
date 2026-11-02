# home-agent

## Purpose

The home agent is the agent stored in the home file. The home block shows the models, the watch list, and the roots. The select that writes the home agent is on the new-role form.

## Requirements

### Requirement: The home agent select is on the new-role form

The home block SHALL show the models, the watch list, and the roots, and SHALL NOT show an agent field above the models. The select that writes the home agent SHALL be the first field of the new-role form, under `Роли`, and its label SHALL be `агент`. While nothing is saved, that list SHALL show `cursor`. Choosing that shown `cursor` SHALL NOT write the home file.

#### Scenario: The home block has no agent field above the models

- **WHEN** the manager opens settings and the home file has no agent
- **THEN** the home block shows the models, the watch list, and the roots, and it has no agent field above the models

#### Scenario: The new-role form leads with the agent

- **WHEN** the manager opens settings
- **THEN** the first field of the new-role form, under `Роли`, is labeled `агент`

#### Scenario: Choosing the shown cursor writes nothing

- **WHEN** nothing is saved and the manager chooses the shown `cursor`
- **THEN** the home file is not written

### Requirement: Sending the new-role form writes the known pair

Choosing an agent the list was not already showing SHALL write the home file at once with that agent and that agent's known pair. Pressing `Добавить`, or changing the role name, the outcome, or the text, SHALL write the home file again with the agent the list is showing and that agent's known pair, even when that agent is already stored. That write SHALL set the models to the known pair, SHALL write effort only when that agent has effort, and SHALL leave no speed key. Choosing the agent the list already shows SHALL NOT send the form, and the home file SHALL stay unchanged.

#### Scenario: Choosing another agent writes the pair

- **WHEN** nothing is saved and the manager chooses `codex` on the new-role form
- **THEN** the home file records `codex` and that agent's known pair

#### Scenario: Добавить writes the shown agent

- **WHEN** nothing is saved and the manager presses `Добавить`
- **THEN** the home file records `cursor` and that agent's known pair

#### Scenario: Sending the form again matches a fresh choice

- **WHEN** the home file already stores an agent, a model has been changed, and the manager presses `Добавить`
- **THEN** the models are that agent's known pair again, effort is written only when that agent has effort, and there is no speed key

#### Scenario: Choosing the shown agent leaves the file

- **WHEN** the list already shows the agent stored in the home file and the manager chooses that agent again
- **THEN** the home file is unchanged
