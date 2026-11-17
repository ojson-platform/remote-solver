- A marked line renders as markdown

sdd-delta: 08b28a0bd8b51c65

## Source

In `src/window/client/sidebar.tsx`, `SpecRows` already paints `DiffRow`. Paint the baseline and the right-hand spec with `paintSourceDocument` from `src/window/client/source-line.tsx`: join the texts on each side into one document per side, paint each document once, and map each `SpecRow` to the painted slice for its line on that side. `lineBody` keeps wrapping changed spans in `span.bit` using the bit tokens already on the row; land the wrap on the painted span of that line, not on raw characters. `DiffRow` does not grow a second parser.

Leave `diff-row` with `add`, `del`, `ctx`, and `plain`, the row button and `data-line`, anchor attributes, number cells, the fold bar, `data-scenario`, remark draft, and posted comments to later slices. Leave Plan, Design, Tasks, the focus block, issue-body rendering, sidebar file edit, and a second document viewer untouched.

Seams (no child issues): shared `paintSourceDocument` in `source-line.tsx` versus row drawing in `sidebar.tsx` versus `lineBody` bit wrap on painted nodes.

## Proof

`src/window/spec-diff.test.ts` observes the rendered Specify spec row: a line with a heading, a list, emphasis, a link, and code renders those as markdown and the marks are not characters of the text.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/spec-diff.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.