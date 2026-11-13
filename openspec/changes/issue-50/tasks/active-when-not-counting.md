- A phase thread leaves acceptance active
- A thread marked for a later phase does not
- A note does not

sdd-delta: 1c5da6b86c1e0662

## Source

When no open review thread counts for this phase, `layerAct` still returns `accept` on the branch that would show acceptance today. Threads marked for a later phase, `note`, `fixed`, `out`, `begin`, and markers for other phases do not count. `hereControl` keeps the active «Принять» in the gate's place with phase naming and without the held hover title.

Cover the three scenarios in `src/window/acceptance.test.ts`. Do not inactivate the control for those cases and do not fill the open-question empty place.

Seams (no child issues): phase-specific marker map in counting vs `decideOpen`; active chrome when machine already withheld vs when no counting thread exists.

## Proof

`src/window/acceptance.test.ts` with only non-counting threads (including later-phase marker and note): the row shows active «Принять» in the gate's place and the control does not say a thread is still open.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/acceptance.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
