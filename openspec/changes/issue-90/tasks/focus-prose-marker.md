- The words after the marker are not rewritten
- The marker line stays the badge and is not a heading

sdd-delta: f9ac38635ce24bd5

## Source

Keep `focusBlockProse` in `src/window/focus.ts` as the words after the marker line, without rewriting them. In `src/window/client/sidebar.tsx`, `FocusBlocks` keeps the marker line as the badge on the first line; render that line as the badge span, not as a heading of the prose beside it. When the drawn marker role is clear, update `src/window/FACE.md` and the Focus block entry in `src/window/CONTEXT.md`. Leave markdown paint beside the badge, scenario jumps, and the live page sentence to later slices.

Linked issues: #88.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` on a written focus: the badge is the first line, the prose beside it is the words after that line unchanged, the marker line is the badge, and that line is not a heading.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.