# home-agent

## Purpose

The home agent is the agent recorded in the home file. The board row, the lamp, and Take read that agent. The control that writes it is the first field of the new-role form.

## Requirements

### Requirement: The home block has no agent field above the models

The home block SHALL show the model fields, the watch list, and the roots before Roles. It SHALL NOT show an agent field above the models. The control that writes the home agent SHALL be the first field of the new-role form under Roles, and its label SHALL be `агент`. That form SHALL also carry the new role's name, outcome, and text, and the add control `Добавить`. Submitting that form SHALL be the home-agent choice.

#### Scenario: Models come before the agent control

- **WHEN** the manager opens settings and the home file has no agent
- **THEN** the home block shows the model fields, the watch list, and the roots, and under Roles the new-role form begins with `агент`

### Requirement: An unsaved agent shows cursor and choosing it does not write

Until an agent is saved, the home agent SHALL be empty. Opening settings SHALL NOT write the home file. The agent list SHALL be `cursor`, `codex`, `claude-code`, and `opencode`, with no empty line. The control SHALL show `cursor`. Choosing that shown `cursor` SHALL NOT submit. The board row SHALL stay `фабрике ещё нужен агент`, the lamp SHALL stay `шаги стоят`, and Take SHALL NOT act.

#### Scenario: Choosing the shown cursor leaves the factory without an agent

- **WHEN** the home file has no agent and the manager chooses the shown `cursor` on `агент`
- **THEN** the home file is not written, the board row is `фабрике ещё нужен агент`, the lamp is `шаги стоят`, and Take does not act

### Requirement: A submitted choice writes the home file at once

A submitted choice SHALL write the home file at once with that agent and that agent's known pair. `Добавить` SHALL submit the form. An empty role name on that submit SHALL store no role. A present role name SHALL store that role as well.

#### Scenario: Choosing another agent writes its pair

- **WHEN** the home file has no agent and the manager chooses `codex` on `агент`
- **THEN** the home file records `codex`, mechanical `gpt-6-luna`, judgment `gpt-6.1-sol`, and effort `low` and `high`, with no speed, the board row `фабрике ещё нужен агент` is gone, and the lamp is `шаги идут`

#### Scenario: Добавить writes the shown agent and a named role

- **WHEN** the home file has no agent, the control shows `cursor`, the role name is `editor`, the outcome is `html`, the text is `черновик`, and the manager presses `Добавить`
- **THEN** the home file records `cursor`, mechanical `composer-2.5-fast`, and judgment `grok-4.7-high-fast`, with no effort and no speed, and the role `editor` is stored

#### Scenario: Добавить with an empty name stores no role

- **WHEN** the home file has no agent, the control shows `cursor`, the role name is empty, and the manager presses `Добавить`
- **THEN** the home file records `cursor`, mechanical `composer-2.5-fast`, and judgment `grok-4.7-high-fast`, and no role is stored

### Requirement: Submitting the saved agent writes its pair again

The agent list SHALL NOT submit when its value does not change. A submitted choice of the agent the home file already records SHALL write that agent's known pair again, in place of the models, effort, and speed already stored.

#### Scenario: Choosing the saved agent on the list changes nothing

- **WHEN** the home file records `cursor` and the manager chooses `cursor` on `агент`
- **THEN** the home file is unchanged

#### Scenario: Submitting the saved agent replaces a custom model

- **WHEN** the home file records `cursor` with mechanical `custom-mechanical` and the form is submitted with `cursor`
- **THEN** mechanical is `composer-2.5-fast` and judgment is `grok-4.7-high-fast`

### Requirement: The layer agent does not record the home agent

The select labeled `агент слоя` SHALL write the checkout overlay of the chosen checkout, including that agent's known pair. It SHALL NOT write the home agent. While the home file has no agent, the board row SHALL stay `фабрике ещё нужен агент`, the lamp SHALL stay `шаги стоят`, and Take SHALL NOT act.

#### Scenario: An overlay agent leaves the factory needing an agent

- **WHEN** the home file has no agent, one checkout is chosen, and the manager chooses `cursor` on `агент слоя`
- **THEN** the checkout overlay records `cursor`, mechanical `composer-2.5-fast`, and judgment `grok-4.7-high-fast`, the home file still has no agent, the board row is `фабрике ещё нужен агент`, the lamp is `шаги стоят`, and Take does not act
