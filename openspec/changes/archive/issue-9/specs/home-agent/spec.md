## RENAMED Requirements

- FROM: `### Requirement: The home block does not choose the agent`
- TO: `### Requirement: The home block chooses the agent`

## MODIFIED Requirements

### Requirement: The home block chooses the agent

The home block SHALL show the models, the watch list, and the roots. It SHALL place its own agent field above the models, and that field SHALL be the one that writes the home agent. The new-role form SHALL NOT have that agent field. The new-role form SHALL carry the new role's name, outcome, and text, and its submit control SHALL be `Добавить`.

#### Scenario: The home block has its own agent field above the models

- **WHEN** the manager opens settings
- **THEN** the home block has its own agent field above the models, the new-role form does not have that agent field, and the home block shows the models, the watch list, and the roots

### Requirement: The agent list has no empty option

The home block's agent field SHALL offer `cursor`, `codex`, `claude-code`, and `opencode`, in that order, and SHALL NOT offer an empty option. The field SHALL be empty until an agent is saved. While no agent is saved the field SHALL NOT show `cursor` as chosen.

#### Scenario: The field is empty until an agent is saved

- **WHEN** no agent is saved and the manager opens settings
- **THEN** the field is empty, `cursor` is not chosen, and the list offers `cursor`, `codex`, `claude-code`, and `opencode` with no empty option

#### Scenario: Opening settings does not save the first option

- **WHEN** no agent is saved and the manager opens settings and closes them
- **THEN** the saved agent is still empty and the home file is still absent

### Requirement: Choosing an agent writes the known pair at once

Choosing an agent the launch offers SHALL write the home file at once with that agent's known pair and SHALL NOT read a live catalog. The known pairs SHALL be cursor `composer-2.5-fast` and `grok-4.7-high-fast`, codex `gpt-6-luna` and `gpt-6.1-sol`, claude-code `sonnet` and `opus`, and opencode `moonshotai/kimi-k2.7-code` and `moonshotai/kimi-k3`. Codex SHALL also write effort `low` for mechanical and `high` for judgment. Claude-code SHALL also write effort `medium` for both modes. Cursor, codex, claude-code, and opencode SHALL NOT write a speed key. Cursor and opencode SHALL NOT write an effort key. After that, choosing the saved agent again SHALL change nothing. An empty offer, or a launch with no home file, SHALL write nothing.

#### Scenario: Cursor writes its pair and the board turns on

- **WHEN** no agent is saved and the manager chooses cursor in the home block
- **THEN** the home file is written at once with that agent's known pair, cursor, `composer-2.5-fast`, and `grok-4.7-high-fast`, with no effort key and no speed key, the board turns on from the agent in the home file, the row `фабрике ещё нужен агент` is gone, the lamp reads `шаги идут`, and Take («Взять») is not refused for lack of an agent

#### Scenario: Codex writes its pair and effort

- **WHEN** the manager chooses codex
- **THEN** the home file records codex, `gpt-6-luna`, `gpt-6.1-sol`, and effort `low` and `high`, and it has no speed key

#### Scenario: Claude-code writes its pair and effort

- **WHEN** the manager chooses claude-code
- **THEN** the home file records claude-code, `sonnet`, `opus`, and effort `medium` and `medium`, and it has no speed key

#### Scenario: OpenCode writes its pair

- **WHEN** the manager chooses opencode
- **THEN** the home file records opencode, `moonshotai/kimi-k2.7-code`, and `moonshotai/kimi-k3`, and it has no effort key and no speed key

#### Scenario: A catalog does not change the pair

- **WHEN** a live catalog names other models and the manager chooses cursor
- **THEN** the home file still records `composer-2.5-fast` and `grok-4.7-high-fast`

#### Scenario: Choosing the saved agent again changes nothing

- **WHEN** the saved agent is cursor, the mechanical model was cleared, and the manager chooses the saved agent again
- **THEN** the home file changes nothing and the mechanical model stays empty

#### Scenario: An empty offer writes nothing

- **WHEN** the launch offers no agent and a choose names cursor
- **THEN** no home file is written and the row stays `фабрике ещё нужен агент`

#### Scenario: No home file path writes nothing

- **WHEN** the launch names no home file and the manager chooses cursor
- **THEN** no home file is written, the row stays `фабрике ещё нужен агент`, and «Взять» writes no assignee

### Requirement: The same submit can add a role

Submitting the new-role form with a non-empty role name SHALL add that role and SHALL NOT write the home agent. An empty role name SHALL NOT add a role and SHALL NOT write the home agent. Choosing an agent in the home block SHALL NOT add a role.

#### Scenario: A named role is added without the home agent

- **WHEN** the new-role form is submitted with the role name `editor`, outcome `html`, and a text
- **THEN** the home file lists that role and the home agent is unchanged

#### Scenario: An empty role name adds no role

- **WHEN** the new-role form is submitted with an empty role name
- **THEN** no role is added and the home agent is unchanged

#### Scenario: Choosing the home agent adds no role

- **WHEN** the manager chooses an agent in the home block
- **THEN** no role is added

### Requirement: The row, the lamp, and Take read the home agent

While the home file has no agent, the row SHALL be `фабрике ещё нужен агент`, the lamp SHALL read `шаги стоят`, and «Взять» SHALL NOT write the assignee. The lamp SHALL read `шаги идут` only when the home agent answers and both home models are filled. Choosing a layer agent SHALL NOT remove that row and SHALL NOT light the lamp.

#### Scenario: The row, the lamp, and Take read the home agent

- **WHEN** the home file has no agent
- **THEN** the row `фабрике ещё нужен агент`, the lamp, and Take all read that agent: the row is `фабрике ещё нужен агент`, the lamp reads `шаги стоят`, and Take («Взять») writes no assignee

#### Scenario: A layer agent does not turn the board on

- **WHEN** the home file has no agent and the manager chooses a layer agent for one checkout
- **THEN** the row stays `фабрике ещё нужен агент` and the lamp stays `шаги стоят`

### Requirement: An empty layer agent means the home agent

The field labeled `агент слоя` SHALL remain the override for that one checkout. It SHALL write that one checkout's overlay at once and SHALL NOT write the home agent. An empty choice SHALL mean the home agent: it SHALL remove the overlay's agent, models, effort, and speed, the merged agent SHALL then be the home agent, and the field SHALL show that merged agent. The overlay models, effort, and speed SHALL keep following the merged factory. When the overlay has its own agent, a missing effort or speed SHALL be that agent's default and SHALL NOT be taken from the home file. The machine without the window SHALL NOT read the overlay. Closing settings SHALL leave the overlay write in place. With no checkout chosen, the field SHALL write nothing. The checkout overlay SHALL stay out of the repository.

#### Scenario: Claude-code on the layer writes the overlay only

- **WHEN** the home file has no agent and the manager chooses claude-code as `агент слоя` and then closes settings
- **THEN** the overlay records claude-code, `sonnet`, `opus`, and effort `medium` and `medium`, and the home file still has no agent

#### Scenario: The layer agent remains the override for that one checkout

- **WHEN** the home agent is cursor and the manager chooses claude-code as `агент слоя` for one checkout
- **THEN** `агент слоя` remains the override for that one checkout and the home agent stays cursor

#### Scenario: Clearing the layer agent shows the home agent

- **WHEN** the home agent is cursor and the manager clears `агент слоя`
- **THEN** empty means the home agent, the overlay file has no agent, no models, no effort, and no speed, and the field shows cursor

#### Scenario: The overlay models, effort, and speed keep following the merged factory

- **WHEN** the home agent is cursor and `агент слоя` is empty
- **THEN** the overlay models, effort, and speed keep following the merged factory

#### Scenario: A codex layer agent does not take home effort

- **WHEN** the overlay agent is codex, the overlay file has no effort key, and the home effort is `max`
- **THEN** the merged effort is `low` and `high`, not `max`

#### Scenario: No chosen checkout writes no overlay

- **WHEN** several checkouts are gathered and the manager has not chosen one
- **THEN** choosing a layer agent writes no overlay

#### Scenario: The checkout overlay stays out of the repository

- **WHEN** the manager chooses `агент слоя` for one checkout
- **THEN** the checkout overlay stays out of the repository
