The page bar above the board is not the phase header
Scrolling the sidebar does not move the header and scrolling the board does not move the sidebar

## Source

Leave `src/window/face.css`, `src/window/FACE.md`, and `src/window/client/board.tsx` untouched. This slice adds or extends tests only; the pin from `board-scroll-pin` already holds.

## Proof

Test file: `src/window/board.test.ts`

Observes the rendered window page HTML and the inlined face stylesheet: the page bar above the board, the phase-name row inside the board, the sidebar scroller, and the board scroller as separate regions.

The test may read `src/window/board.test.ts`, the page harness helpers it already imports, and rendered HTML from the same paths existing board page tests use.

Commands that must exit 0:

`pnpm test -- src/window/board.test.ts`

`pnpm test`

`pnpm run test:types`
