# plaque-key

## Purpose

The key beside the title is the issue key as text. It sits in the control that opens the sidebar.

## Requirements

### Requirement: The key beside the title is text in the control that opens the sidebar

The key SHALL be the issue key as text, in the same control as the title. Activating that control while the sidebar is closed SHALL open the sidebar for that cycle. Activating it again while the sidebar is open for this cycle SHALL close the sidebar. The control SHALL NOT take the ticket. The key SHALL NOT be a link. A cycle that names a repository and a cycle that names none SHALL both show the key as that text.

#### Scenario: The key and the title sit in one control

- **WHEN** a cycle is on the board
- **THEN** the key is the issue key as text, the title is text, and both sit in the control that opens the sidebar

#### Scenario: Activating the control opens the sidebar

- **WHEN** the sidebar is closed and the manager activates the key of a cycle on the board
- **THEN** the sidebar opens for that cycle and the ticket is not taken

#### Scenario: A second activation closes the sidebar

- **WHEN** the sidebar is open for a cycle and the manager activates that cycle's key again
- **THEN** the sidebar closes and the ticket is not taken

#### Scenario: A named repository leaves the key as text

- **WHEN** a cycle is on the board and the cycle names a repository
- **THEN** the key is text and is not a link

#### Scenario: No repository leaves the key as text

- **WHEN** a cycle is on the board and the cycle names no repository
- **THEN** the key is text and is not a link
