# home-agent

## Purpose

The home agent is the agent recorded in the home file. The row `фабрике ещё нужен агент`, the lamp, and Take read that agent. The select that writes it is the first field of the new-role form.

## Requirements

### Requirement: The home agent select is the first field of the new-role form

The home block SHALL show the mechanical and judgment models, the watch list, and the roots. It SHALL NOT show an agent field above the models. Under `Роли`, the new-role form SHALL begin with a select labeled `агент`. That select SHALL list `cursor`, `codex`, `claude-code`, and `opencode`, and SHALL NOT offer an empty line. The same form SHALL carry the new role's name, outcome, and text, and SHALL end with `Добавить`.

#### Scenario: The agent select sits under Roles

- **WHEN** the manager opens settings and the home file has no agent
- **THEN** the models, the watch list, and the roots are above `Роли`, and the select labeled `агент` is the first field of the new-role form

### Requirement: Nothing saved leaves the first line showing and the factory waiting

Until an agent is written, the recorded agent SHALL be empty, including when the home file already holds a watch list and roots.
No line of the select SHALL be marked, and the first line SHALL be `cursor`.
Choosing that line SHALL NOT submit and SHALL NOT write an agent.
The board SHALL show `фабрике ещё нужен агент`, the lamp SHALL say `шаги стоят`, and Take SHALL NOT act.

#### Scenario: Choosing the shown cursor does not write

- **WHEN** the home file has no agent and the manager chooses the `cursor` the list already shows
- **THEN** the form does not submit, the recorded agent stays empty, the board shows `фабрике ещё нужен агент`, the lamp says `шаги стоят`, and Take does not act

### Requirement: A submit writes the known pair at once

Changing the select to another line SHALL submit the form.
`Добавить` SHALL submit the form as it stands, and while no line is marked that submit SHALL post `cursor`.
When the launch named a home file, offers the posted agent, and the home file on disk still matches the copy settings read, that agent SHALL be written at once with its known pair.
Cursor SHALL be written as mechanical `composer-2.5-fast` and judgment `grok-4.7-high-fast`, with no effort and no speed.
Submitting the agent already saved SHALL write that pair again and SHALL drop a model the manager had put in its place.
When the role name on the form is filled, the same submit SHALL also add that role.
Closing settings SHALL NOT erase the agent this submit wrote.
After `cursor` is written and that agent answers, the board SHALL NOT show `фабрике ещё нужен агент`, the lamp SHALL say `шаги идут`, and Take SHALL NOT stay refused for a missing agent.

#### Scenario: Add writes the shown cursor

- **WHEN** the home file has no agent and the manager uses `Добавить` with the role name empty
- **THEN** the home file records `cursor`, mechanical `composer-2.5-fast`, and judgment `grok-4.7-high-fast`, with no effort and no speed, and closing settings leaves that agent in place

#### Scenario: Changing the select writes codex at once

- **WHEN** the home file has no agent and the manager changes the select to `codex`
- **THEN** the home file records `codex`, mechanical `gpt-6-luna`, judgment `gpt-6.1-sol`, and effort `low` for mechanical and `high` for judgment, with no speed, before settings close

#### Scenario: Submitting the saved agent replaces an edited model

- **WHEN** the saved agent is `cursor`, the mechanical model has been changed, and the form is submitted with `cursor` again
- **THEN** the mechanical model is `composer-2.5-fast` again

#### Scenario: Choosing the saved agent again does not submit

- **WHEN** the home file records `cursor`, the mechanical model has been changed, and the manager chooses `cursor` in the select again
- **THEN** the form does not submit and the edited mechanical model stays

#### Scenario: A filled role name is added on the same submit

- **WHEN** the manager submits the new-role form with a role name and `cursor`
- **THEN** the home file records `cursor` and that role

#### Scenario: A written cursor clears the waiting row

- **WHEN** `cursor` has been written and that agent answers
- **THEN** the board does not show `фабрике ещё нужен агент`, the lamp says `шаги идут`, and Take is not refused for a missing agent

### Requirement: The layer select does not record the home agent

The select labeled `агент слоя` SHALL write the selected checkout's overlay and SHALL NOT write the home agent.
While the home file has no agent, the board SHALL still show `фабрике ещё нужен агент`, the lamp SHALL still say `шаги стоят`, and Take SHALL still not act.

#### Scenario: A layer agent leaves the factory waiting

- **WHEN** one checkout is selected, the home file has no agent, and the manager chooses `cursor` on `агент слоя`
- **THEN** the home file still has no agent, the board shows `фабрике ещё нужен агент`, the lamp says `шаги стоят`, and Take does not act
