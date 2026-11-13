- A thread with no marker counts as this phase

sdd-delta: 1c5da6b86c1e0662

## Source

In the same `layerAct` counting path as `held-accept-in-gate`, treat a thread with no marker as counting for this phase on Plan, Specify, and Design (one counting thread is enough, with or without a line). Conversation comments are not threads. Counting runs only after the row would otherwise show acceptance.

Adjust fixtures in `src/window/acceptance.test.ts` for the unmarked case; reuse `held` painting in `src/window/client/sidebar.tsx`. Do not change later-phase, note, or open-question branches in this slice.

Seams (no child issues): null marker vs explicit phase marker in review JSON; unmarked thread ownership stays #49 plumbing, counting rule is this change.

## Proof

`src/window/acceptance.test.ts` with an unmarked open thread on the active phase row: the gate shows inactive «Принять» with the held hover, proving the unmarked thread counts.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/acceptance.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
