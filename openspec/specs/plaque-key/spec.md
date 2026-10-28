# plaque-key

## Purpose

The key names the cycle on its row. When a repository is named, the key is a link beside the title control that opens the sidebar. When no repository is named, the key stays text in that control.

## Requirements

### Requirement: The key is a link to the issue

When a cycle names a repository, the row SHALL show that cycle's key as a link to the issue page of the repository the cycle names. A cycle that names no repository SHALL keep the key as text inside the same control as the title, and that key SHALL NOT be a link.

#### Scenario: A named repository makes the key a link to the issue

- **WHEN** a cycle names a repository and its row is on the board
- **THEN** the key is that cycle's key as a link to the issue page of the repository the cycle names

#### Scenario: No repository leaves the key as text

- **WHEN** a cycle names no repository and its row is on the board
- **THEN** the key is that cycle's key as text, inside the same control as the title, and the key is not a link

### Requirement: Activating the key follows the link and does not take the cycle

When a cycle names a repository, the key and the title SHALL NOT be one control. Activating the key SHALL follow the link to the issue page of the repository the cycle names, SHALL NOT open the sidebar, SHALL NOT close the sidebar, and SHALL NOT take the cycle. Activating the title while the sidebar is not open for that cycle SHALL open the sidebar for that cycle. Activating the title while the sidebar is open for that cycle SHALL close the sidebar. Activating the title SHALL NOT take the cycle.

#### Scenario: Activating the key follows the link and does not open the sidebar

- **WHEN** a cycle names a repository, the sidebar is not open for that cycle, and the manager activates the key
- **THEN** the activation follows the link to the issue page of the repository the cycle names, the sidebar stays closed, and the activation does not take the cycle

#### Scenario: Activating the key follows the link and does not close the sidebar

- **WHEN** a cycle names a repository, the sidebar is open for that cycle, and the manager activates the key
- **THEN** the activation follows the link to the issue page of the repository the cycle names, the sidebar stays open, and the activation does not take the cycle

#### Scenario: The first activation of the title opens the sidebar

- **WHEN** the sidebar is not open for that cycle and the manager activates the title
- **THEN** the sidebar opens for that cycle and that activation does not take the cycle

#### Scenario: A second activation of the title closes the sidebar

- **WHEN** the sidebar is open for that cycle and the manager activates the title again
- **THEN** the sidebar closes and that activation does not take the cycle
