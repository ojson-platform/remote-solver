- A chevron that cannot move stays in place and goes quiet, so the number does not jump
- A round that cannot move stays in place and goes quiet

sdd-delta: e51e36369ca7899f

## Source

In `src/window/client/sidebar.tsx`, a round that cannot move stays in the control and goes quiet like disabled play: class `off` and the `disabled` attribute. On the latest page that is forward; on the oldest page that is back. The round does not disappear and the count does not jump. Assume `button.round` drawing from `focus-pager-round-face`. Leave click handling and index changes in `src/window/client/main.tsx` to `focus-pager-back-forward`. Leave single-focus absence to `focus-pager-single-focus`.

Seams (no child issues): quiet `off`/`disabled` on the drawn control vs click listener ignoring disabled buttons in `main.tsx`; boundary index vs rendered quiet state.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` on the oldest and latest pages: the round that cannot move stays in place, carries `off` and `disabled`, and the count does not jump.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
