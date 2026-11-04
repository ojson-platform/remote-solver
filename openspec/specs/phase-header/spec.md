# phase-header

## Purpose

The phase header is the row of phase names over the board. It stays at the top of the board while the board scrolls. Its background stays transparent. A ticket row that scrolls up fades out in the clear band under the names, and at rest the first row starts below that band.

## Requirements

### Requirement: The phase header stays at the top of the board

The phase header SHALL be the row of phase names over the board scroll. The phase header SHALL stay at the top of the board while the board scrolls. The seven phase names SHALL stay aligned with the station columns under them. The header background SHALL stay transparent. A row that scrolls up SHALL fade out in the clear band under the names, and the names SHALL stay readable. At rest the first row SHALL start below that band and stay fully readable. The page bar above the board SHALL NOT be the phase header. Scrolling the sidebar SHALL NOT move this header, and scrolling the board SHALL NOT move the sidebar.

#### Scenario: The phase header stays at the top of the board while the board scrolls

- **WHEN** the phase header is already visible at the top of the board while the board scrolls, together with scrolling the sidebar as the limit that can replace that board scroll
- **THEN** the phase header stays at the top of the board while the board scrolls

#### Scenario: The seven phase names stay aligned with the station columns under them

- **WHEN** the seven phase names are already visible and aligned with the station columns under them, together with the board scroll that can move those columns out from under the names
- **THEN** the seven phase names stay aligned with the station columns under them

#### Scenario: A row that scrolls up fades out under the names and the names stay readable

- **WHEN** a ticket row scrolls up toward the phase names
- **THEN** the row fades out in the clear band under the names, the header background stays transparent, and at rest the first row starts below that band fully readable

#### Scenario: The page bar above the board is not the phase header

- **WHEN** the page bar is already visible above the board, together with the phase header, the row of phase names inside the board, as the limit that can replace that bar
- **THEN** the page bar above the board is not the phase header

#### Scenario: Scrolling the sidebar does not move the header and scrolling the board does not move the sidebar

- **WHEN** the phase header and the sidebar are already visible, and scrolling the sidebar does not move this header, together with scrolling the board as the limit that can replace that scroll
- **THEN** scrolling the sidebar does not move this header, and scrolling the board does not move the sidebar
