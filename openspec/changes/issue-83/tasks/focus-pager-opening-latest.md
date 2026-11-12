- Opening still lands on the latest page

sdd-delta: ce50ed28804c49ad

## Source

In `src/window/client/main.tsx`, opening still passes no page index so the first paint is the latest page. Assume pager drawing and count reading from `focus-pager-round-face`. Leave Back and Forward index changes to `focus-pager-back-forward`.

Seams (no child issues): omitted index on open vs initial `pageIndex` in sidebar paint; opening path vs in-session Back/Forward.

## Proof

`src/window/board.test.ts` observes the rendered sidebar on open: landing on the latest page with the pager showing that page's count.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
