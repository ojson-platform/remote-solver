- A scenario line carries its scenario name

sdd-delta: 3943a98f4b1fa6c6

## Source

A line that names a scenario keeps `data-scenario` with that scenario name on the rendered row (`scenarioOf` on `row.text`). Edit `src/window/client/sidebar.tsx` in `DiffRow` so the attribute stays on the row button or the non-button row after markdown paint.

Leave focus prose jumps and `scenarioTarget` in `gesture.ts` as they are unless a test needs a fixture line.

Seams (no child issues): `data-scenario` on `DiffRow` versus focus jump in `board.test.ts`.

## Proof

`src/window/board.test.ts` observes the rendered sidebar Specify spec row: a line that names a scenario carries `data-scenario` with that scenario name.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.