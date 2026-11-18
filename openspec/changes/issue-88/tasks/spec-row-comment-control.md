- The row button is the comment control
- A row with no pull request is not a comment control
- A line with no text is not a comment control

sdd-delta: 33f631d2b8ae49e2

## Source

When a pull request is open and the line has text, the comment control stays the `diff-row` button: not `button.line`, `data-line` is the line text. When no pull request is open, or the line has no text, the row is not a comment control (a `div`, not a button). Edit `src/window/client/sidebar.tsx` in `DiffRow` only as needed to preserve this contract after markdown paint.

Leave remark draft open on click, anchor attributes, `PostedComments`, and `LineNote` to the remark slice.

Seams (no child issues): `showButton` and row versus button markup in `DiffRow` versus pull state from `SpecRows`.

## Proof

`src/window/spec-diff.test.ts` observes the rendered Specify spec row: with an open pull request and text, the row is a `diff-row` button with `data-line` equal to that text and is not `button.line`; with no pull request the row is not a comment control; with empty text the row is not a comment control.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/spec-diff.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.