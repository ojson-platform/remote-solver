# plaque-key

## Purpose

The key names the cycle on its row. It is text in the same control as the title, and that control opens the sidebar.

## Requirements

### Requirement: The key is text

The row SHALL show the cycle's key as text inside the same control as the title. The key SHALL NOT be a link. A cycle that names a repository and a cycle that names none SHALL both keep the key as text.

#### Scenario: A named repository leaves the key as text

- **WHEN** a cycle names a repository and its row is on the board
- **THEN** the key is that cycle's key as text, inside the same control as the title, and the key is not a link

#### Scenario: No repository leaves the key as text

- **WHEN** a cycle names no repository and its row is on the board
- **THEN** the key is that cycle's key as text, inside the same control as the title, and the key is not a link

### Requirement: Activating the key opens or closes the sidebar and does not take the cycle

The key and the title SHALL be one control. Activating that control while the sidebar is not open for that cycle SHALL open the sidebar for that cycle. Activating it while the sidebar is open for that cycle SHALL close the sidebar. The activation SHALL NOT take the cycle.

#### Scenario: The first activation of the key opens the sidebar

- **WHEN** the sidebar is not open for that cycle and the manager activates the key
- **THEN** the sidebar opens for that cycle and that activation does not take the cycle

#### Scenario: A second activation of the key closes the sidebar

- **WHEN** the sidebar is open for that cycle and the manager activates the key again
- **THEN** the sidebar closes and that activation does not take the cycle

#### Scenario: The first activation of the title opens the sidebar

- **WHEN** the sidebar is not open for that cycle and the manager activates the title
- **THEN** the sidebar opens for that cycle and that activation does not take the cycle

#### Scenario: A second activation of the title closes the sidebar

- **WHEN** the sidebar is open for that cycle and the manager activates the title again
- **THEN** the sidebar closes and that activation does not take the cycle
