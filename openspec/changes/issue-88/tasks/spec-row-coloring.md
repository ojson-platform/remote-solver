- Added, deleted, and unchanged rows keep their classes
- A changed span is marked
- A line with no changed span has no marked span
- An unchanged spec row is plain

sdd-delta: 08b28a0bd8b51c65

## Source

On the painted `DiffRow` from the markdown slice, keep `diff-row` with `add`, `del`, or `ctx`, and add `plain` when the spec has no addition and no deletion (`specIsPlain`). A changed span stays `span.bit` on the painted line; an unchanged span of a replaced line is not `span.bit`; a line with no changed span has no `span.bit`. Edit `src/window/client/sidebar.tsx` only as needed for class names and `lineBody` bit placement on painted nodes.

Leave markdown paint wiring, the row comment control, anchor data, number cells, the fold bar, `data-scenario`, and remark draft to other slices. Leave face.css unless a test already reads it for these rows.

Seams (no child issues): row class on `DiffRow` versus `lineBody` bit tokens on painted spans versus `specIsPlain` on `SpecRows`.

## Proof

`src/window/spec-diff.test.ts` observes the rendered Specify spec row: added, deleted, and unchanged rows keep `diff-row` with `add`, `del`, or `ctx`; a changed span is `span.bit` and an unchanged span is not; a line with no changed span has no `span.bit`; when the spec has no addition and no deletion each row carries `diff-row`, `ctx`, and `plain`.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/spec-diff.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.