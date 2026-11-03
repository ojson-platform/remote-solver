## Problem

Keep the phase header pinned while the board scrolls.

## Outcome

The phase header stays at the top of the board while the board scrolls. The seven phase names stay aligned with the station columns under them. A row that scrolls up passes beneath the header, and the names stay readable over it.

## Scope

The header is the row of phase names inside the board.

## Out of scope

Pinning the ticket titles. Pinning the page bar. A second header.

## Constraints

The page bar above the board is not it. Scrolling the sidebar does not move this header, and scrolling the board does not move the sidebar.

## Capabilities

### Added

- `phase-header`: stays at the top of the board while the board scrolls

### Modified

## Open questions
