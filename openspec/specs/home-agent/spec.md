# home-agent

## Purpose

The home agent is the agent recorded in the home file. The board row, the lamp, and Take read that agent. The control that writes it is the first field of the new-role form.

## Requirements

### Requirement: The home block has its own agent field above the models

The home block SHALL show its own agent field above the models, then the model fields, the watch list, and the roots, before Roles. That field SHALL be the control that writes the home agent, and its label SHALL be `агент`. The new-role form under Roles SHALL NOT have that field. That form SHALL carry the new role's name, outcome, and text, and the add control `Добавить`.

#### Scenario: The home block has its own agent field above the models and the new-role form does not

- **WHEN** the manager opens settings, the home block already shows its agent field above the models, the model fields, the watch list, and the roots, and the new-role form under Roles is the other place that field can sit
- **THEN** the home block has its own agent field above the models, labeled `агент`, and the new-role form does not

### Requirement: The agent field is empty until an agent is saved

Until an agent is saved, the home agent field SHALL be empty. Opening settings SHALL NOT write the home file. The agent list SHALL be `cursor`, `codex`, `claude-code`, and `opencode`. The board row SHALL stay `фабрике ещё нужен агент`, the lamp SHALL stay `шаги стоят`, and Take SHALL NOT act.

#### Scenario: The field is empty until an agent is saved

- **WHEN** the manager opens settings, the home file has no agent, the agent field above the models is visible and empty, and a saved agent is the other value that can fill that field
- **THEN** the field is empty, the home file is not written, the list is `cursor`, `codex`, `claude-code`, and `opencode`, the board row is `фабрике ещё нужен агент`, the lamp is `шаги стоят`, and Take does not act

### Requirement: Choosing an agent writes the home file at once

Choosing an agent on the home block's field `агент` SHALL write the home file at once with that agent and that agent's known pair. When the home file had no agent, that write SHALL clear the board row `фабрике ещё нужен агент`, and the lamp SHALL be `шаги идут`.

#### Scenario: Choosing an agent writes the home file at once with that agent's known pair

- **WHEN** the home file has no agent, the field `агент` is empty, the manager chooses `cursor`, and the empty field is the other value that choice replaces
- **THEN** the home file is written at once with `cursor` and that agent's known pair, mechanical `composer-2.5-fast` and judgment `grok-4.7-high-fast`, with no effort and no speed, the board row `фабрике ещё нужен агент` is gone, and the lamp is `шаги идут`

#### Scenario: Choosing codex writes its known pair at once

- **WHEN** the home file has no agent, the field `агент` is empty, the manager chooses `codex`, and the empty field is the other value that choice replaces
- **THEN** the home file is written at once with `codex` and that agent's known pair, mechanical `gpt-6-luna`, judgment `gpt-6.1-sol`, and effort `low` and `high`, with no speed, the board row `фабрике ещё нужен агент` is gone, and the lamp is `шаги идут`

#### Scenario: Choosing a different agent writes that agent's known pair at once

- **WHEN** the home file records `cursor`, mechanical `composer-2.5-fast`, and judgment `grok-4.7-high-fast`, the manager chooses `codex` on `агент`, and cursor's pair is the other value that codex's known pair replaces
- **THEN** the home file is written at once with `codex` and that agent's known pair, mechanical `gpt-6-luna`, judgment `gpt-6.1-sol`, and effort `low` and `high`, with no speed

### Requirement: Choosing the saved agent again changes nothing

Choosing the agent the home file already records SHALL change nothing. The home file SHALL keep that agent and the models, effort, and speed already stored.

#### Scenario: Choosing the saved agent again changes nothing

- **WHEN** the home file records `cursor` with mechanical `custom-mechanical`, the field `агент` shows `cursor`, the manager chooses `cursor` again, and the known pair mechanical `composer-2.5-fast` and judgment `grok-4.7-high-fast` is the other value that choice could write
- **THEN** choosing the saved agent again changes nothing, and the home file still records `cursor` with mechanical `custom-mechanical`

### Requirement: The layer agent does not record the home agent

The select labeled `агент слоя` SHALL remain the override for that one checkout. Choosing an agent on `агент слоя` SHALL write that checkout's overlay with the new agent, that agent's known pair, and the default effort and speed. A key the agent does not have SHALL stay absent. Old effort and speed keys SHALL NOT remain. That choice SHALL NOT write the home agent. An empty `агент слоя` SHALL mean the home agent. While `агент слоя` is empty, the overlay models, effort, and speed SHALL keep following the merged factory. The checkout overlay SHALL stay out of the repository. While the home file has no agent, the board row SHALL stay `фабрике ещё нужен агент`, the lamp SHALL stay `шаги стоят`, and Take SHALL NOT act.

#### Scenario: An overlay agent leaves the factory needing an agent

- **WHEN** the home file has no agent, one checkout is chosen, the overlay has no effort key and no speed key, the manager chooses `cursor` on `агент слоя`, and leaving the merged factory's models, effort, and speed in place is the other value that choice could write
- **THEN** the checkout overlay records the new agent `cursor`, the known pair mechanical `composer-2.5-fast` and judgment `grok-4.7-high-fast`, and the default effort and speed, so the effort key stays absent and the speed key stays absent, the home file still has no agent, the board row is `фабрике ещё нужен агент`, the lamp is `шаги стоят`, and Take does not act

#### Scenario: агент слоя remains the override for that one checkout

- **WHEN** one checkout is chosen, `агент слоя` shows `cursor` for that checkout, and an empty `агент слоя` is the other value that can replace that override
- **THEN** `агент слоя` remains the override for that one checkout

#### Scenario: Empty means the home agent

- **WHEN** the home file records `cursor`, one checkout is chosen, `агент слоя` is empty, and `cursor` on `агент слоя` is the other value that can replace that empty
- **THEN** the empty `агент слоя` means the home agent `cursor`

#### Scenario: Choosing cursor on агент слоя writes the known pair and drops old effort and speed

- **WHEN** the home file records `codex`, mechanical `gpt-6-luna`, judgment `gpt-6.1-sol`, and effort `low` and `high`, one checkout's overlay records mechanical `custom-mechanical`, judgment `custom-judgment`, effort `max`, and speed `fast`, the manager chooses `cursor` on `агент слоя`, and keeping mechanical `custom-mechanical`, judgment `custom-judgment`, effort `max`, and speed `fast` is the other value that choice could write
- **THEN** the checkout overlay records the new agent `cursor`, the known pair mechanical `composer-2.5-fast` and judgment `grok-4.7-high-fast`, and the default effort and speed, the effort key is absent, the speed key is absent, the old effort and speed keys do not remain, and the home file still records `codex`, mechanical `gpt-6-luna`, judgment `gpt-6.1-sol`, and effort `low` and `high`

#### Scenario: The overlay models, effort, and speed keep following the merged factory

- **WHEN** `агент слоя` is empty, the merged factory for that checkout has mechanical `custom-mechanical`, judgment `custom-judgment`, and no effort and no speed, the overlay models, effort, and speed already show those values, and choosing `cursor` on `агент слоя`, with mechanical `composer-2.5-fast` and judgment `grok-4.7-high-fast`, is the other value that can replace those models, effort, and speed
- **THEN** the overlay models, effort, and speed keep following the merged factory: mechanical `custom-mechanical`, judgment `custom-judgment`, and no effort and no speed

#### Scenario: The checkout overlay stays out of the repository

- **WHEN** one checkout is chosen, the checkout overlay is already written, and the repository is the other place that overlay can be stored
- **THEN** the checkout overlay stays out of the repository
