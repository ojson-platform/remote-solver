# home-agent

## Purpose

The agent in the home file is the one the board turns on from. The home block shows the models, the watch list, and the roots, and it does not place an agent field above the models. The new-role form writes that agent and its known pair. The layer agent writes one checkout's overlay and does not take the home agent's place.

## Requirements

### Requirement: The home block does not choose the agent

The home block SHALL show the models, the watch list, and the roots. It SHALL NOT place an agent field above the models. Under Roles, the new-role form SHALL start with a field labeled `агент`, and that field SHALL be the one that writes the home agent. The same form SHALL carry the new role's name, outcome, and text, and its submit control SHALL be `Добавить`.

#### Scenario: An unsaved agent leaves no agent field above the models

- **WHEN** the manager opens settings and no agent is saved
- **THEN** the home block shows the models, the watch list, and the roots, the first field under Roles is `агент`, and opening settings has not written the home file

### Requirement: The agent list has no empty option

The `агент` field SHALL offer `cursor`, `codex`, `claude-code`, and `opencode`, in that order, and SHALL NOT offer an empty option. The saved agent SHALL stay empty until a choose writes it. The form SHALL submit when the select changes, and `Добавить` SHALL submit it. An option that is already selected SHALL NOT submit.

#### Scenario: Opening settings does not save the first option

- **WHEN** no agent is saved and the manager opens settings and closes them
- **THEN** the saved agent is still empty and the home file is still absent

### Requirement: Choosing an agent writes the known pair at once

Choosing an agent the launch offers SHALL write the home file at once and SHALL NOT read a live catalog. The known pairs SHALL be cursor `composer-2.5-fast` and `grok-4.7-high-fast`, codex `gpt-6-luna` and `gpt-6.1-sol`, claude-code `sonnet` and `opus`, and opencode `moonshotai/kimi-k2.7-code` and `moonshotai/kimi-k3`. Codex SHALL also write effort `low` for mechanical and `high` for judgment. Claude-code SHALL also write effort `medium` for both modes. Cursor, codex, claude-code, and opencode SHALL NOT write a speed key. Cursor and opencode SHALL NOT write an effort key. Choosing the saved agent again SHALL write that pair again, so a model the manager changed is replaced. The select SHALL NOT submit that choose when its option does not change. An empty offer, or a launch with no home file, SHALL write nothing.

#### Scenario: Cursor writes its pair and the board turns on

- **WHEN** the manager chooses cursor
- **THEN** the home file records cursor, `composer-2.5-fast`, and `grok-4.7-high-fast`, with no effort key and no speed key, the row `фабрике ещё нужен агент` is gone, the lamp reads `шаги идут`, and «Взять» is not refused for lack of an agent

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

#### Scenario: A submitted choose of the saved agent restores the pair

- **WHEN** the saved agent is cursor, the mechanical model was cleared, and cursor is submitted again
- **THEN** the mechanical model is `composer-2.5-fast` again

#### Scenario: An unchanged select does not submit

- **WHEN** the saved agent is cursor, the mechanical model was cleared, and the select's option stays cursor
- **THEN** the form does not submit and the mechanical model stays empty

#### Scenario: An empty offer writes nothing

- **WHEN** the launch offers no agent and a choose names cursor
- **THEN** no home file is written and the row stays `фабрике ещё нужен агент`

#### Scenario: No home file path writes nothing

- **WHEN** the launch names no home file and the manager chooses cursor
- **THEN** no home file is written, the row stays `фабрике ещё нужен агент`, and «Взять» writes no assignee

### Requirement: The same submit can add a role

Submitting the new-role form with a non-empty role name SHALL write the agent and SHALL add that role. An empty role name SHALL write the agent and SHALL NOT add a role. A choose that is not this form SHALL NOT add a role.

#### Scenario: A named role is added with the agent

- **WHEN** the new-role form is submitted with cursor, the role name `editor`, outcome `html`, and a text
- **THEN** the home file records cursor and that role

#### Scenario: An empty role name adds no role

- **WHEN** the new-role form is submitted with cursor and an empty role name
- **THEN** the home file records cursor and lists no role

### Requirement: The row, the lamp, and Take read the home agent

While the home file has no agent, the row SHALL be `фабрике ещё нужен агент`, the lamp SHALL read `шаги стоят`, and «Взять» SHALL NOT write the assignee. The lamp SHALL read `шаги идут` only when the home agent answers and both home models are filled. Choosing a layer agent SHALL NOT remove that row and SHALL NOT light the lamp.

#### Scenario: A missing home file leaves the row, the lamp, and Take

- **WHEN** the home file is absent
- **THEN** the row is `фабрике ещё нужен агент`, the lamp reads `шаги стоят`, and «Взять» writes no assignee

#### Scenario: A layer agent does not turn the board on

- **WHEN** the home file has no agent and the manager chooses a layer agent for one checkout
- **THEN** the row stays `фабрике ещё нужен агент` and the lamp stays `шаги стоят`

### Requirement: An empty layer agent means the home agent

The field labeled `агент слоя` SHALL write that one checkout's overlay at once and SHALL NOT write the home agent. An empty choice SHALL remove the overlay's agent, models, effort, and speed. The merged agent SHALL then be the home agent, and the field SHALL show that merged agent. The overlay's models, effort, and speed SHALL show the merged factory. When the overlay has its own agent, a missing effort or speed SHALL be that agent's default and SHALL NOT be taken from the home file. The machine without the window SHALL NOT read the overlay. Closing settings SHALL leave the overlay write in place. With no checkout chosen, the field SHALL write nothing.

#### Scenario: Claude-code on the layer writes the overlay only

- **WHEN** the home file has no agent and the manager chooses claude-code as `агент слоя` and then closes settings
- **THEN** the overlay records claude-code, `sonnet`, `opus`, and effort `medium` and `medium`, and the home file still has no agent

#### Scenario: Clearing the layer agent shows the home agent

- **WHEN** the home agent is cursor and the manager clears `агент слоя`
- **THEN** the overlay file has no agent, no models, no effort, and no speed, and the field shows cursor

#### Scenario: A codex layer agent does not take home effort

- **WHEN** the overlay agent is codex, the overlay file has no effort key, and the home effort is `max`
- **THEN** the merged effort is `low` and `high`, not `max`

#### Scenario: No chosen checkout writes no overlay

- **WHEN** several checkouts are gathered and the manager has not chosen one
- **THEN** choosing a layer agent writes no overlay
