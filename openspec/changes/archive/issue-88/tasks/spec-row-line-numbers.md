- A changed row keeps both number cells and the fold bar is separate
- An unchanged spec shows one line number
- A code block keeps the line numbers in sequence
- A fence marker stays a row

sdd-delta: 33f631d2b8ae49e2

## Source

On the painted `DiffRow`, keep baseline and folded number cells on changed rows and one number cell on an unchanged spec. Rendering the line as markdown does not remove those cells. A fence marker line stays its own row with number cells; fence marks do not stay characters of the text; the following row shows the next line number. A code block in the line does not show a line number for each visual line; the following row shows the next line number. The fold of unchanged lines stays a `fold-bar` that is not the comment control.

Edit `src/window/client/sidebar.tsx` and `numberCell` usage in `DiffRow`/`SpecRows` as needed. Do not remove number cells.

Leave remark draft, anchor attributes, and board scenario jump to other slices.

Seams (no child issues): number cells on `DiffRow` versus painted fence and code-block lines versus `fold-bar` in `SpecRows`.

## Proof

`src/window/spec-diff.test.ts` observes the rendered Specify spec row: a changed row shows both number cells; an unchanged spec shows one line number per row; with a fold of unchanged lines the fold is a separate `fold-bar`; a changed line with a code block keeps both number cells without per-visual-line numbers and the next row shows the next line number; a fence marker stays a row with number cells and fence marks not in the text, and the following row shows the next line number.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/spec-diff.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.