- A single written focus leaves the control out
- One written focus still leaves the pager out
- The row is the badge and the prose

sdd-delta: e51e36369ca7899f

## Source

In `src/window/client/sidebar.tsx`, one written focus still renders no `.focus-pager`; the focus row is then the badge and the prose only. Assume round pager drawing from earlier slices when more than one page exists. Leave index walk and opening in `src/window/client/main.tsx` and page membership in `src/window/focus.ts` as they are.

Seams (no child issues): page count in `focus.ts` vs conditional pager markup in `FocusBlocks`; single-focus row layout vs multi-page pager row.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` with one written focus: no `.focus-pager`, row is badge and prose only.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
