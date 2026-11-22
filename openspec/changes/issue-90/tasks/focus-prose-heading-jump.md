- A heading mark on a later line stays in front of the jump

sdd-delta: 60598f439f900bc1

## Source

In `src/window/client/sidebar.tsx`, when a scenario name sits on a later line of a multi-line list item and that line carries a heading mark, `FocusBlocks` shows that item's list mark once and a heading mark on that line once, in front of the jump button. That line is not painted as a heading. That line's document paint does not include those two marks. Update `src/window/FACE.md` and the Focus block entry in `src/window/CONTEXT.md` with that sentence. Assume `focus-prose-mark-close`.

Linked issues: #88.

## Proof

`src/window/sidebar.test.ts` observes rendered `FocusBlocks` on a written focus where a scenario name sits on a later line of a multi-line list item and that line carries a heading mark: the prose beside the badge shows that item's list mark once and a heading mark on that line once, in front of the jump button, that line is not painted as a heading, and that line's document paint does not include those two marks.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --maxWorkers=1 --reporter=default 'src/window/sidebar.test.ts' -t '<titles>'`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.