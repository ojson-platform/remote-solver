sdd-absorbed: 78e6ee08f5d87091

## Verification boundary

`spec-row`. Scenarios are observed on the rendered Specify spec row, where `SpecRows` paints `DiffRow`. The markdown line, the row classes, `span.bit`, the row button, `data-line`, the anchor, the number cells, and the fold bar are that row in `src/window/spec-diff.test.ts`. The scenario name on the row is the rendered sidebar in `src/window/board.test.ts`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

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

The spec row's line is that paint. `paintSourceDocument` takes one document. The diff has a baseline and a right-hand document, so each is painted with that function, and the row shows the paint of its own line. `DiffRow` does not grow a parser.

Rejected: a second parser for the spec row.

The row keeps `diff-row` with `add`, `del`, or `ctx`, and `plain` when the spec has no addition and no deletion. A changed span stays `span.bit`. A line with no changed span has no `span.bit`. The comment control stays the row button and is not a `button.line`. `data-line` stays the line text. An anchored row keeps the file, the line, and side `right`. A changed row keeps both number cells, and an unchanged spec shows one line number. The fold bar stays separate from the row. `data-scenario` stays the scenario name. A click opens the remark draft. A row with no anchor still opens a draft and shows no posted line comment.

The characters of the line come from `paintSourceDocument`, so a heading, a list, emphasis, a link, and code render as markdown and those marks do not stay characters of the text. `lineBody` still wraps a changed span in `span.bit`. The wrap uses the bit tokens already on the row. It does not parse that span on its own.

Risk: those tokens are the raw line, and the paint is the node value. The wrap lands on the painted span of that line.

Plan, Design, Tasks, and the focus block stay as they are. The sidebar does not edit the file, does not add a second document viewer, and does not render the issue body.

After merge the spec row is that paint. No flag and no follow-up step.

## Open decisions

none
