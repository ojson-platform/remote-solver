While no written page exists, the live page is the only page and Back does nothing

Opening the sidebar returns the block to now

A worker starting returns the block to now

A new written comment returns the block to now

## Source

In `src/window/client/sidebar.tsx` and `focusIndexAfterSnapshot` (or equivalent index helper), hide Back when only the live page exists; return index to 0 when the open ticket key changes, when the newest written body changes, and when a worker turn for this key appears (sidebar open, new written comment, worker starting). While a live page is present and a review gate is off, now is that live page; when held action or checks appear without those triggers, shift index so the caller stays on the same written page.

Leave plaque sentence and row held action untouched.

## Proof

`src/window/sidebar.test.ts` observes Back doing nothing with only a live page, and opening the sidebar, a worker starting, and a new written comment returning the block to now.

- `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
