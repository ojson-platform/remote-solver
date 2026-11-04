The page bar above the board is not the phase header

Scrolling the sidebar does not move the header and scrolling the board does not move the sidebar

## Source

Leave `src/window/face.css`, `src/window/FACE.md`, `openspec/specs/phase-header/spec.md`, `src/window/client/board.tsx`, and `src/window/client/main.tsx` untouched. The fade and padding from `board-fade-padding` already hold. This slice adds or extends tests only so the page bar, the phase header, the sidebar scroller, and the board scroller stay separate caller-visible regions.

Seams: `.top` page bar above the board frame; `.head` outside the board scrollport; `.sidebar` fixed with `.side-scroll` as its scroller; `.board` as the board scroller.

## Proof

Test file: `src/window/board.test.ts`

Observes the rendered window page HTML and the inlined face stylesheet: the page bar above the board, the phase-name row inside the board frame but outside the board scrollport, the sidebar scroller, and the board scroller as separate regions.

May read: `src/window/board.test.ts`, the page harness helpers it already imports, and rendered HTML from the same paths existing board page tests use.

Commands that must exit 0:

- `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.

`pnpm run test:types`
