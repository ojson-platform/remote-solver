The phase header stays at the top of the board while the board scrolls
The seven phase names stay aligned with the station columns under them
A row that scrolls up passes beneath the header and the names stay readable over it

## Source

Pin the existing `.head` row inside the board scrollport. Edit `src/window/face.css` and `src/window/FACE.md` only. Leave `src/window/client/board.tsx` and ticket title markup untouched unless sticky needs `align-self: start` on the board column; then change only layout in `face.css`, not a second header row and not `position: fixed` on `.head`. Do not pin `.top`, ticket titles, or the drawer brass band.

## Proof

Test file: `src/window/board.test.ts`

Observes the rendered window page HTML and the inlined face stylesheet: the phase-name row inside the board, the seven station columns under it, and a ticket row that scrolls beneath `.head`.

The test may read `src/window/board.test.ts`, the page harness helpers it already imports, and rendered HTML from the same paths existing board page tests use.

Commands that must exit 0:

`pnpm test -- src/window/board.test.ts`

`pnpm test`

`pnpm run test:types`
