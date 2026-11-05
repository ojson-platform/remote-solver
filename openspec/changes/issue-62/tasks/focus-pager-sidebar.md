Opening still lands on the latest page

The control sits in the right part of the focus row and scrolls with the block

The row is the chosen placement

The header pin and the right-rim solid are not

## Source

Assumes `focus-pager-control` scenarios already hold.

Keep `.focus-block` the first child of `.side-scroll` in `src/window/client/sidebar.tsx` so the focus row scrolls with the block. The sidebar header does not hold the pager; the drawer rim does not hold it. `WindowView` in the served path passes no page index so opening and the first paint land on the latest page.

Leave chips in the header, reason and ask blocks, `writtenFocusPages`, and the Back and Forward walk untouched unless placement wiring requires a minimal fix.

## Proof

`src/window/board.test.ts` observes the rendered sidebar: opening on the latest page, the control in the right part of the focus row inside `.side-scroll`, the row as the chosen placement, and the header and the drawer rim without that control.

The one-file command is the check on each attempt; the layer command and the type check run once after that command exits 0.

- `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
