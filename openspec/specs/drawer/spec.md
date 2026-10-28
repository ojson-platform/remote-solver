# drawer

## Purpose

The drawer is the one open cycle over the board.

## Requirements

### Requirement: The drawer holds one open cycle

The open cycle SHALL open a sidebar over the board, from the right, at `min(560px, 92vw)`, and SHALL NOT narrow the stations. There SHALL be no rail and no shelf. One cycle SHALL be open: opening another SHALL close the previous, and a second click on the open cycle SHALL close it.

#### Scenario: Opening another row closes the previous

- **WHEN** one row is open and the manager opens another
- **THEN** the previous row closes and the new row is the only open row

#### Scenario: An open row does not narrow its neighbors

- **WHEN** a row opens
- **THEN** the station widths of the other rows stay as they were

#### Scenario: The sidebar is a wide drawer

- **WHEN** a cycle is open
- **THEN** the sidebar is a fixed drawer on the right, `min(560px, 92vw)` wide, and the stations keep their width

#### Scenario: A second click closes the cycle

- **WHEN** a cycle is open and the manager clicks it again
- **THEN** the sidebar closes and the cycle is no longer open
