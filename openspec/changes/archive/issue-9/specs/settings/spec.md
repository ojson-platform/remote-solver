## MODIFIED Requirements

### Requirement: Choosing an agent writes at once

The home block SHALL have its own agent field, above the models, labeled `агент`. The new-role form SHALL NOT have an agent field. The field SHALL be empty until an agent is saved. Choosing an agent in the home block SHALL write the home config at once, including the known pair when this agent has one. Choosing the saved agent again SHALL leave the home file unchanged. An empty agent list SHALL NOT write the file. An emptied field SHALL be written as soon as the manager leaves it, including an empty model. Settings SHALL show that an empty model still needs a value. An empty effort and an empty speed SHALL NOT. Closing settings SHALL NOT erase a value the home block has written. The home block SHALL still show the models, the watch list, and the roots. `агент слоя` SHALL remain the override for that one checkout. An empty overlay agent SHALL mean the home agent. The overlay models, effort, and speed SHALL keep following the merged factory. The checkout overlay SHALL stay out of the repository.

#### Scenario: The agent field sits above the models

- **WHEN** the manager opens settings
- **THEN** the home block shows an agent field labeled `агент` above the models, and still shows the models, the watch list, and the roots

#### Scenario: The new-role form has no agent field

- **WHEN** the manager opens the new-role form under Roles
- **THEN** that form has no agent field

#### Scenario: An unsaved agent field is empty

- **WHEN** the home file records no agent
- **THEN** the agent field is empty

#### Scenario: Choosing cursor writes the home file

- **WHEN** the agent field is empty, the manager chooses cursor, and cursor has a known pair
- **THEN** the home file records cursor and that pair, and the row, the lamp, and Take read that agent

#### Scenario: Choosing the saved agent again changes nothing

- **WHEN** the home file already records an agent and the manager chooses that same agent again
- **THEN** the home file is unchanged

#### Scenario: An empty overlay agent means the home agent

- **WHEN** the home file records an agent and `агент слоя` is empty
- **THEN** the row, the lamp, and Take read the home agent

#### Scenario: The overlay agent does not write the home file

- **WHEN** the home file records no agent and the manager sets `агент слоя` for a checkout
- **THEN** the home file still has no agent, the row stays `фабрике ещё нужен агент`, and that checkout's overlay records the agent

#### Scenario: Overlay models, effort, and speed follow the merged factory

- **WHEN** the manager opens settings on a checkout
- **THEN** the overlay models, effort, and speed follow the merged factory, and the checkout overlay stays out of the repository

#### Scenario: An empty agent list writes nothing

- **WHEN** the window has no agent to offer
- **THEN** no home file is written

#### Scenario: Leaving a model empty writes the empty field

- **WHEN** the manager clears `models.judgment` and leaves the field
- **THEN** the home file records that field empty and settings show that the field still needs a value
