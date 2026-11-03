## Verification boundary

`phase-header`: the rendered window page, the same page `src/window/board.test.ts` already draws. Scenarios are observed on that HTML and the inlined face stylesheet: the phase-name row inside the board, the seven station columns under it, a ticket row, the page bar above the board, and the sidebar's own scroller.

One file: `pnpm test -- <test-file>`
Layer: `pnpm test`
Fast suite: none
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

The phase header is the existing name row inside the board, not a new row. `Board` in `src/window/client/board.tsx` already draws it as `.head`: an empty key cell, then one `.phase` for each of the seven `COLUMN_NAMES`. `.head` and `.stations` share one grid, `252px repeat(7, minmax(0, 1fr))`, so the names stay on the station columns. The board (`.board`) is the scrollport (`overflow-y: auto`). The page bar (`.top`) sits above `.stage` in `.app` and does not scroll with the board. The sidebar is `position: fixed` and scrolls inside `.side-scroll`.

Pin that one row. In `src/window/face.css`, `.head` is `position: sticky; top: 0`, with a stacking level above the tickets and a ground-tinted cover so a row that passes underneath does not hide the names. The cover is not a slab, not a brass band, and not a border or a shadow. The board keeps no slab of its own. `src/window/FACE.md` records that pin in the same session as the look.

The stick stays inside the board's scrollport. `.app` already clips the room; the header's scrollport is `.board`. If a column flex item refuses to stick, `align-self: start` keeps the row at the height of the names. Do not move the board's overflow clip onto an ancestor between `.head` and `.board`.

Rejected: `position: fixed` on `.head`. The names would leave the shared grid, and the page bar and banners would own the offset. Rejected: a second name row outside the scroller. Rejected: pinning `.top` or the ticket titles. Rejected: the drawer's brass sticky band. That band is the open section head, and these names stay muted.

## Open decisions

none
