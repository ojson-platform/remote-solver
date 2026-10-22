# settings

## Purpose

Settings is the window's editor in two blocks. The user block writes the home config immediately. The service block has two groups, and each group shows the file it changes. Both groups write the checkout of the open card.

## Requirements

### Requirement: Settings are two blocks and do not open themselves

Settings SHALL be two blocks. They SHALL NOT open themselves when the home config is missing, when the recorded agent does not answer, or when a service config on disk does not read. The user block SHALL write the launch file immediately: the agent and that agent's fields, the roles, the watch list, and the checkout roots. The service block SHALL have two groups. The overlay group SHALL show `.aifactory/config.yaml`. The service-config group SHALL show `openspec/config.yaml`.

#### Scenario: A missing home file leaves settings closed

- **WHEN** the home config is absent
- **THEN** settings stay closed until the manager opens them

#### Scenario: Each group names its file

- **WHEN** the manager opens settings on a card
- **THEN** the overlay group shows `.aifactory/config.yaml` and the service-config group shows `openspec/config.yaml`

### Requirement: Service groups write the open card's checkout

Both service groups SHALL write the checkout of the open card. When the board has one checkout, that checkout SHALL be selected. When settings are opened with no card and several checkouts are already gathered, the manager SHALL choose among those. Until a checkout is chosen, the groups SHALL be empty and SHALL write nothing.

#### Scenario: One checkout is selected

- **WHEN** the board has one checkout and the manager opens settings with no card
- **THEN** both groups show that checkout

#### Scenario: No choice writes nothing

- **WHEN** several checkouts are gathered and the manager has not chosen one
- **THEN** both groups are empty and write no file

### Requirement: A write rereads the file first

Before the user block writes, and before the service-config group saves, the window SHALL reread that file. When the disk already has another copy, the write SHALL NOT proceed and the manager SHALL see the disk. The overlay group SHALL write immediately, and it SHALL reread first the same way.

#### Scenario: A newer home file blocks the user block

- **WHEN** the home file on disk differs from the copy settings read, and the manager edits the user block
- **THEN** the window does not write and shows the disk copy

#### Scenario: A newer service config blocks the save

- **WHEN** `openspec/config.yaml` on disk differs from the copy the group read, and the manager saves
- **THEN** the group does not write and shows the disk copy

### Requirement: The overlay group writes immediately

The overlay group SHALL write `.aifactory/config.yaml` of the chosen checkout immediately, and that file SHALL NOT be part of the repository. Closing settings SHALL NOT erase a value this group has written.

#### Scenario: An overlay edit is on disk before settings close

- **WHEN** the manager changes the overlay agent and then closes settings
- **THEN** `.aifactory/config.yaml` already has that agent

### Requirement: The service-config group writes on save

The service-config group SHALL write `openspec/config.yaml` of the chosen checkout when that group is saved. Until that save, the spy SHALL read the previous file. Closing settings SHALL discard an unsaved edit of this group. A key inside `sdd` that has no field SHALL remain. `schema`, `context`, and `rules` SHALL remain as they were.

#### Scenario: Closing discards an unsaved edit

- **WHEN** the manager edits a queue name and closes settings without saving
- **THEN** `openspec/config.yaml` is unchanged

#### Scenario: The spy reads the previous file

- **WHEN** the service-config group has an unsaved edit
- **THEN** the spy reads the file on disk

### Requirement: Choosing an agent writes at once

Choosing an agent in the user block SHALL write the home config at once, including the known pair when this agent has one. An empty agent list SHALL NOT write the file. An emptied field SHALL be written as soon as the manager leaves it, including an empty model. Settings SHALL show that an empty model still needs a value. An empty effort and an empty speed SHALL NOT. Closing settings SHALL NOT erase a value the user block has written.

#### Scenario: Choosing cursor writes the home file

- **WHEN** the manager chooses cursor and cursor has a known pair
- **THEN** the home file records cursor and that pair

#### Scenario: An empty agent list writes nothing

- **WHEN** the window has no agent to offer
- **THEN** no home file is written

#### Scenario: Leaving a model empty writes the empty field

- **WHEN** the manager clears `models.judgment` and leaves the field
- **THEN** the home file records that field empty and settings show that the field still needs a value
