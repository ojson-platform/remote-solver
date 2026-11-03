## ADDED Requirements

### Requirement: The phase header stays at the top of the board

The phase header SHALL be the row of phase names inside the board. The phase header SHALL stay at the top of the board while the board scrolls. The seven phase names SHALL stay aligned with the station columns under them. A row that scrolls up SHALL pass beneath the header, and the names SHALL stay readable over it. The page bar above the board SHALL NOT be the phase header. Scrolling the sidebar SHALL NOT move this header, and scrolling the board SHALL NOT move the sidebar.

#### Scenario: The phase header stays at the top of the board while the board scrolls

- **WHEN** the phase header is already visible at the top of the board while the board scrolls, together with scrolling the sidebar as the limit that can replace that board scroll
- **THEN** the phase header stays at the top of the board while the board scrolls

#### Scenario: The seven phase names stay aligned with the station columns under them

- **WHEN** the seven phase names are already visible and aligned with the station columns under them, together with the board scroll that can move those columns out from under the names
- **THEN** the seven phase names stay aligned with the station columns under them

#### Scenario: A row that scrolls up passes beneath the header and the names stay readable over it

- **WHEN** the names are already readable over the header, together with a row that scrolls up and can cover those names
- **THEN** a row that scrolls up passes beneath the header, and the names stay readable over it

#### Scenario: The page bar above the board is not the phase header

- **WHEN** the page bar is already visible above the board, together with the phase header, the row of phase names inside the board, as the limit that can replace that bar
- **THEN** the page bar above the board is not the phase header

#### Scenario: Scrolling the sidebar does not move the header and scrolling the board does not move the sidebar

- **WHEN** the phase header and the sidebar are already visible, and scrolling the sidebar does not move this header, together with scrolling the board as the limit that can replace that scroll
- **THEN** scrolling the sidebar does not move this header, and scrolling the board does not move the sidebar
