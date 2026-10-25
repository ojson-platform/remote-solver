# factory-config

## Purpose

Factory config is one agent and that agent's own fields. The home config supplies the values. A service overlay replaces any key it contains. The machine without the window does not read it. The home file and the overlay are the whole store.

## Requirements

### Requirement: The home config is the file the launch named

The home config SHALL be the file whose path the launch passed. No path SHALL mean no home file is written. Two processes SHALL NOT share that file. The home file SHALL store `agent`, `models.mechanical`, `models.judgment`, `effort` and `speed` by skill mode when that agent has them, `watch`, `roots.arcadia`, `roots.github`, and `roles`. It SHALL NOT store a person field, and it SHALL NOT store a cycle's phase, focus, or metrics. `openspec/config.yaml` SHALL NOT receive the agent or the models.

#### Scenario: No launch path writes no home file

- **WHEN** the launch passes no home path and the manager would otherwise choose an agent
- **THEN** no home file is written

#### Scenario: The home file has no person field

- **WHEN** the manager takes a cycle
- **THEN** the home file gains no person field

### Requirement: The service overlay replaces keys and does not replace roots

The service overlay SHALL be `.aifactory/config.yaml` at the checkout root. A missing overlay file SHALL be normal. The overlay SHALL store factory-config keys and its own `watch`, and SHALL NOT store roles or checkout roots. A key on the overlay SHALL replace that home key. Roots SHALL stay the home roots. The overlay file SHALL NOT be part of the repository. The machine without the window SHALL NOT read `.aifactory`.

#### Scenario: An overlay model replaces the home model

- **WHEN** the home `models.mechanical` is `composer-2.5-fast` and the overlay sets `models.mechanical` to another id
- **THEN** the merged factory config for that checkout uses the overlay id

#### Scenario: A missing overlay keeps the home values

- **WHEN** the checkout has no `.aifactory/config.yaml`
- **THEN** the merged factory config is the home config

#### Scenario: The machine without the window ignores the overlay

- **WHEN** the machine runs without the window and the overlay has an empty model
- **THEN** that empty model does not stop the machine

### Requirement: The merged config is one agent and that agent's fields

The merged factory config SHALL be one agent and that agent's fields: the two skill-mode models, and effort and speed only when that agent has them. The two model slots MAY use the same id. The window's spy SHALL take the agent and the models for a step from this merged config. A running step SHALL keep the model it started with. The next step SHALL read the new file. The machine without the window SHALL be satisfied by the service config: queues are required, and `base`, `branch-scope`, and `ignore-comments` have defaults.

#### Scenario: A running step keeps its model

- **WHEN** a step has started and the manager then changes `models.mechanical`
- **THEN** that step keeps the model it started with, and the next step reads the new file

#### Scenario: The same id may fill both slots

- **WHEN** the manager sets both skill-mode models to one id
- **THEN** the merged config records that id in both slots

### Requirement: A known pair is written with the agent

Choosing an agent SHALL NOT read a live model catalog. A catalog that disagrees with the table below SHALL NOT change the pair. When the agent has a known pair, that pair SHALL be written with the agent. When it has none, both models SHALL be empty. The known pairs SHALL be: cursor `composer-2.5-fast` and `grok-4.7-high-fast`; codex `gpt-6-luna` and `gpt-6.1-sol`; claude-code `sonnet` and `opus`; opencode `moonshotai/kimi-k2.7-code` and `moonshotai/kimi-k3`. The agents the factory can run SHALL be cursor, codex, claude-code, and opencode.

#### Scenario: Cursor writes its pair

- **WHEN** the manager chooses cursor
- **THEN** `models.mechanical` is `composer-2.5-fast` and `models.judgment` is `grok-4.7-high-fast`

#### Scenario: Codex writes its pair

- **WHEN** the manager chooses codex
- **THEN** `models.mechanical` is `gpt-6-luna` and `models.judgment` is `gpt-6.1-sol`

#### Scenario: Claude-code writes its pair

- **WHEN** the manager chooses claude-code
- **THEN** `models.mechanical` is `sonnet` and `models.judgment` is `opus`

#### Scenario: OpenCode writes its pair

- **WHEN** the manager chooses opencode
- **THEN** `models.mechanical` is `moonshotai/kimi-k2.7-code` and `models.judgment` is `moonshotai/kimi-k3`

### Requirement: Changing the agent replaces the whole set

Changing the agent SHALL replace the set, at home and on the overlay. The home file SHALL write the known values of the new set. The overlay SHALL write the new agent, the known pair, and the default effort and speed. A key the agent does not have SHALL be absent. An empty string SHALL NOT be written. Old effort and speed keys SHALL NOT remain. Changing the agent SHALL NOT write an empty model.

Home and overlay defaults SHALL be: cursor has no effort field and no speed field; codex writes effort `low` for `mechanical` and `high` for `judgment`, and does not write speed; claude-code writes effort `medium` for both skill modes and has no speed field; opencode has no effort field and no speed field.

#### Scenario: Codex replaces a cursor set

- **WHEN** the home agent changes from cursor to codex
- **THEN** the file has codex, `gpt-6-luna`, `gpt-6.1-sol`, and effort `low` and `high`, and it has no speed key and no cursor model id

#### Scenario: OpenCode writes no effort key

- **WHEN** the overlay agent changes to opencode
- **THEN** the overlay file has the OpenCode pair and has no `effort` key and no `speed` key

### Requirement: Effort and speed are the agent's own fields

The window SHALL show the fields of the chosen agent. Cursor SHALL have no separate effort field and no separate speed field. For an agent that has effort, `effort` SHALL be one of `low`, `medium`, `high`, `xhigh`, and `max`, and the window SHALL show only the words that skill mode's model accepts. For an agent that has speed, `speed` SHALL be `fast`, and a missing key SHALL mean ordinary speed. Codex SHALL have a speed field, and the default SHALL be to omit the key. Claude-code and the OpenCode pair SHALL have no speed field. The OpenCode pair SHALL have no effort field. Empty effort and empty speed SHALL mean the agent's default and SHALL NOT stop the window's spy. An empty model SHALL stop the window spy's steps for that service, and SHALL stop «Взять» on a cycle of that service that has no phase. It SHALL NOT stop «Взять» on a cycle that already has a phase.

#### Scenario: Empty effort does not stop a step

- **WHEN** codex has an empty effort and both models are set
- **THEN** the window's spy is not stopped by that empty effort

#### Scenario: An empty model stops Take on a phaseless cycle

- **WHEN** the merged `models.mechanical` is empty and the cycle has no phase
- **THEN** «Взять» does not act for that service and the window's spy does not start its step

### Requirement: An overlay agent does not borrow effort or speed

When the overlay has its own agent, a missing effort or speed SHALL mean that agent's default and SHALL NOT be taken from home. Clearing the overlay agent SHALL remove the agent, both models, effort, and speed. Clearing a model SHALL remove that key, and the field SHALL show the home value. Clearing effort or speed SHALL remove that key. When the overlay has no agent of its own, the field SHALL show the home value.

#### Scenario: An overlay agent ignores home effort

- **WHEN** the overlay agent is codex and the overlay file has no `effort` key, and home effort is `max`
- **THEN** the merged effort is codex's default, not `max`

#### Scenario: Clearing the overlay agent drops the set

- **WHEN** the manager clears the overlay agent
- **THEN** the overlay file has no `agent`, no model, no `effort`, and no `speed`

#### Scenario: Clearing a model shows home

- **WHEN** the manager clears the overlay `models.judgment` and the overlay has no agent of its own
- **THEN** the field shows the home `models.judgment`

### Requirement: A recorded agent or model that fails is kept

A recorded agent that no longer answers SHALL NOT be erased. A recorded model id the agent no longer accepts SHALL NOT be erased.

#### Scenario: A silent agent leaves the file

- **WHEN** the recorded agent does not answer
- **THEN** the home file still contains that agent

#### Scenario: A rejected id leaves the file

- **WHEN** the agent answers and rejects the recorded model id
- **THEN** the file still contains that id
