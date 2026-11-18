sdd-absorbed: d4d385d183f05da8

## Verification boundary

`spec-row`. Scenarios are observed on the rendered Specify spec row, where `SpecRows` paints `DiffRow`. The markdown line, the row classes, `span.bit`, the row button, `data-line`, the anchor, the number cells, and the fold bar are that row in `src/window/spec-diff.test.ts`. A row with no pull request, and a line with no text, are not a comment control on that row. An unchanged span of a replaced line is not `span.bit` on that row. When the changed token of a replaced line is a marked word, the painted span of that line is `span.bit` on that row. A code span whose position spans two source lines shows the paint of its own line on that row, and a line the value does not contain does not show the raw source. A code block that keeps the line numbers in sequence is that same row: the row keeps its number cells, a cell with no number is empty, the block does not show a line number for each of its visual lines, and the following row shows the next line number. The scenario name on the row is the rendered sidebar in `src/window/board.test.ts`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

fast suite: none
`pnpm run test:types`
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts` or `src/**/*.test.tsx`

## External contracts

none

## Technical prerequisites

none

## Approach

The seams are the ones the window already draws. `SpecRows` paints `DiffRow` in `src/window/client/sidebar.tsx`. Plan and Design paint a source with `paintSourceDocument` in `src/window/client/source-line.tsx`, and `PlanLines` already calls it.

The spec row's line is that paint. `paintSourceDocument` takes one document. The diff has a baseline and a right-hand document, so each is painted with that function, and the row shows the paint of its own line. When a code span's position spans two source lines, the row shows the paint of its own line. A line the value does not contain does not show the raw source. The paint of a code block stays in that one row: a code block in the line does not show a line number for each of its visual lines, and the following row shows the next line number. `DiffRow` does not grow a parser.

Rejected: a second parser for the spec row. Rejected: removing the number cells. Rejected: showing the raw source of a line the value does not contain.

A fence marker is a source line, and that line stays a row. The row keeps its number cells, the fence marks do not stay characters of the text, and the following row shows the next line number.

The row keeps `diff-row` with `add`, `del`, or `ctx`, and `plain` when the spec has no addition and no deletion. A changed span stays `span.bit`. An unchanged span of that line is not `span.bit`. A line with no changed span has no `span.bit`. When a pull request is open and the line has text, the comment control stays the row button and is not a `button.line`. When no pull request is open, or the line has no text, the row is not a comment control. `data-line` stays the line text. An anchored row keeps the file, the line, and side `right`. A changed row keeps both number cells, and an unchanged spec shows one line number. A code block in the line does not show a line number for each of its visual lines, and the following row shows the next line number. The fold bar stays separate from the row. `data-scenario` stays the scenario name. A click opens the remark draft. A row with no anchor still opens a draft and shows no posted line comment.

The characters of the line come from `paintSourceDocument`, so a heading, a list, emphasis, a link, and code render as markdown and those marks do not stay characters of the text. `lineBody` still wraps a changed span in `span.bit`. The wrap uses the bit tokens already on the row. It does not parse that span on its own. When the changed token of a replaced line is a marked word, the painted span of that line is `span.bit`.

Risk: those tokens are the raw line, and the paint is the node value. The wrap lands on the painted span of that line.

Plan, Design, Tasks, and the focus block stay as they are. The sidebar does not edit the file, does not add a second document viewer, and does not render the issue body.

After merge the spec row is that paint. No flag and no follow-up step.

## Open decisions

- [x] Keep the number cells. A fence-marker line stays a row, so the following row shows the next line number. Removing the number cells is rejected.
