sdd-absorbed: 5203d0361d4326a4

## Verification boundary

`source-line`. Scenarios are observed on the Plan and Design documents the sidebar paints, in `src/window/source-line.test.ts`. On each surface, every source line `PlanLines` paints renders markdown (headings, lists, emphasis, links, and code) and stays a comment target. A click opens the remark draft on that line. The painted line is not a diff row. `PlanLines` stays the leaf. `data-line` is the source line with trailing space removed and is the draft key. `data-path` is `proposal.md` or `design.md` under the change read path. `data-at` is the source line number `sectionsOf` assigns. `data-side` is `right`. `LineNote` and posted line comments stay on that path and line. On Design, `model.design.questions` is passed only for Open questions, and a checkbox outside Open questions stays a line comment. A `##` line stays the section `h3`, not a button. A `###` line stays the `h4` from `partsOf`, not a button. A run of blank lines stays one `span.gap`. With no pull request, the line stays a `p.line` and is not a comment target. The phase foot stays outside the document. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter. `pnpm test` is the CI run of the package script `vitest --run`.

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

The seams are the ones `CONTEXT-MAP.md` already names. The window draws the sidebar and places each review thread on the line it anchors. This change stays in the window. The machine does not settle it, and no adapter grows a call.

`sectionsOf` in `src/window/spine.ts` still splits a `##` line into the section heading and still assigns the source line number. `partsOf` in `src/window/client/sidebar.tsx` still lifts a `###` line to the `h4` and does not pass that line on. `PlanDocument` and `DesignDocument` still call only `PlanLines`. `PlanLines` stays the leaf: it chooses `p.line` or `button.line`, sets `data-line` to the source line with trailing space removed, sets `data-path` to `proposal.md` or `design.md` under the change read path, sets `data-at` from the number `sectionsOf` assigned, sets `data-side` to `right`, matches an open question against the raw line, paints `LineNote`, paints the posted comments on that path and line, and collapses a run of blank lines to one `span.gap`. On Design, Open questions still receives `model.design.questions`. Every other section still receives an empty list, so a checkbox outside Open questions stays a line comment. The phase foot stays `reviewFold`, a sibling after the document, not inside `.doc`.

The new function is `sourceLine` in `src/window/client/source-line.tsx`. It takes one source line, the same string `data-line` already holds, and returns the nodes for that line only. `PlanLines` puts those nodes inside `p.line` and inside `button.line` in place of the raw string. `sourceLine` does not read the spine, the draft, the pull request, or the review, and it does not set the data attributes.

Both parents admit phrasing content. A `p` drops a heading or a list out of itself, and a `button` may not hold a second control. So `sourceLine` emits phrasing only: `em`, `strong`, `code`, `a`, and `span`. A heading line that still reaches the leaf (`#`, or `####` and deeper) paints the heading text in a `span`, without the hash marks, and is not an `h1`–`h6` and not a button. A `##` line and a `###` line never reach it. A list line paints that one item in a `span`, marker included as presentation, and does not join the next line into a `ul` or an `ol`. Emphasis, strong, inline code, and a link replace their source markers. A link is an `a` with its href. A task checkbox is that list presentation, not an `input`, so the question match and the line comment stay on the raw line. A fence stays one line: that line is `code`, and the following source lines stay their own comment targets.

The document click listener in `src/window/client/main.tsx` still opens the remark draft from `button.line` through `data-line`. When the click is inside that button it prevents the default, so an anchor inside the line does not navigate and the draft still opens. On `p.line` there is no listener: the line is not a comment target, and an anchor navigates.

Specify (`SpecRows` and `TaskFile`), the focus block, and the issue description do not call `sourceLine`. The function is the one those children will call later. No new colour, ground, measure, or control name. A code span in a document line uses the monospaced face the type already gives a key, a path, and a capability name. The drawing session adds that span to the monospaced sentence in `src/window/FACE.md`. `CONTEXT.md` does not gain a word: the line is still the document line, and choosing it still opens the field.

After merge, Plan and Design paint each source line through `sourceLine`, and the line stays the comment target it is today. No flag and no follow-up step.

Rejected: parsing a section as one markdown document. That would fuse lines, drop the per-line draft key, and could turn a `##` line into a button. Rejected: a second document viewer, and a library that paints a document. Rejected: a diff row on these lines. Rejected: an `input` for a checkbox. Rejected: a `pre` or a list element that spans source lines. Rejected: editing the file from the sidebar. Rejected: rendering the issue body. Rejected: calling `sourceLine` from Specify, Tasks, or the focus block in this change.

## Open decisions

none
