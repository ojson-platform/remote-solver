The block goes when the cycle leaves the pool

## Source

Keep description assembly in `src/window/sidebar.ts` gated on pool membership via `slotOf`. A cycle on a station column (no longer in the pool) must not receive a description block even when the issue body has author text.

Extend or adjust `src/window/sidebar.test.ts` and, if needed, `src/window/window.test.ts` only for assertions that compare pool-open vs column-open sidebar blocks. Do not show the description after the cycle leaves the pool and do not add a second fetch of the issue body.

## Proof

Test file: `src/window/sidebar.test.ts`

Observes `window.sidebar()` when the same ticket is opened from the pool versus from a column card: the description block is present only for the pool open; opening from a column leaves it out.

May read: `src/window/sidebar.ts`, `src/window/window.ts`, `src/window/window.harness.ts`, `src/window/board.ts`.

Commands that must exit 0:

- `pnpm test -- src/window/sidebar.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.

`pnpm run test:types`
