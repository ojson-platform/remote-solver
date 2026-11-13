sdd-absorbed: e4abe49594ac2ead

## Verification boundary

`source-line`. Scenarios are observed on the Plan and Design documents the sidebar paints, and on the spec section, in `src/window/source-line.test.ts`. Plan and Design render the source as one markdown document. Headings, lists, emphasis, links, and code render in that document. A source line is not wrapped as its own markdown document. The source line a rendered place came from stays a comment target. A click on a rendered place opens the remark draft on that source line. The painted place is not a diff row. The spec section is one markdown document whose text is marked with the diff. That marking renders in the document and is not a diff row beside a source line. `PlanLines` stays the leaf that renders the markdown document. `data-line` is the source line the rendered place came from, with trailing space removed, and stays the draft key. `data-path` is `proposal.md` or `design.md` under the change read path. `data-at` is the source line number the rendered place came from, the number `sectionsOf` assigns. `data-side` is `right`. `LineNote` and posted line comments stay on that path and line. On Design, `model.design.questions` is passed only for Open questions, and a checkbox outside Open questions stays a line comment. A `##` line stays the section `h3`, not a button. A `###` line stays the `h4` from `partsOf`, not a button. A run of blank lines stays one `span.gap`. With no pull request, the line stays a `p.line` and a place in the rendered document is not a comment target. The phase foot stays outside the document. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter. `pnpm test` is the CI run of the package script `vitest --run`.

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

Plan and Design render the source as one markdown document. `PlanLines` is the leaf that renders it. A source line is not parsed as its own markdown document and is not wrapped as one. Headings, lists, emphasis, links, and code render in that document. `sectionsOf` in `src/window/spine.ts` still assigns the source line number a rendered place came from. A `##` line is the section `h3` in that document, not a button. `partsOf` in `src/window/client/sidebar.tsx` still supplies the `h4` for a `###` line, and that line is not a button. `PlanDocument` and `DesignDocument` still call only `PlanLines`.

Each rendered place keeps the source line it came from. `PlanLines` sets `data-line` to that line with trailing space removed, `data-path` to `proposal.md` or `design.md` under the change read path, `data-at` from the number `sectionsOf` assigned, and `data-side` to `right`. It matches an open question against the raw line, paints `LineNote`, paints the posted comments on that path and line, and collapses a run of blank lines to one `span.gap`. On Design, Open questions still receives `model.design.questions`. Every other section still receives an empty list, so a checkbox outside Open questions stays a line comment. The phase foot stays `reviewFold`, a sibling after the document, not inside `.doc`. A place that spans several source lines still exposes each source line it came from, so the draft key is not fused across them.

The shared renderer lives in `src/window/client/source-line.tsx`. It takes the source of the one document and returns the nodes `PlanLines` paints. It does not read the spine, the draft, the pull request, or the review, and it does not set the data attributes. Later surface children call this renderer. This cycle, `PlanLines` is the leaf.

The spec section composes that document with the diff marking in the text, then renders the marking through the same leaf. The marking is text in the document. It is not a diff row beside a source line. Tasks and the focus block do not call the renderer. The issue description does not either.

The document click listener in `src/window/client/main.tsx` still opens the remark draft from the place's `data-line`. When the click is on a comment target it prevents the default, so an anchor in the place does not navigate and the draft still opens. With no pull request the line stays a `p.line`: there is no listener, the place is not a comment target, and an anchor navigates.

A task checkbox stays the list's presentation, not an `input`, so the question match and the line comment stay on the raw line. A button cannot wrap a block, so the comment target is the rendered place in the one document, not a button around a private document for that line. A `##` line and a `###` line stay `h3` and `h4`.

No new colour, ground, measure, or control name. A code span in the document uses the monospaced face the type already gives a key, a path, and a capability name. The drawing session adds that span to the monospaced sentence in `src/window/FACE.md`. `CONTEXT.md` does not gain a word: the line is still the document line, and choosing it still opens the field.

After merge, Plan and Design paint the source as one markdown document through `PlanLines`, each place stays the comment target of its source line, and the spec section renders the diff marking in that document. No flag and no follow-up step.

Rejected: wrapping each source line as its own markdown document. That cannot render headings, lists, and code as one document. Rejected: a diff row beside a source line, on Plan, Design, and the spec section. Rejected: a second document viewer, and a library that replaces `PlanLines` as the leaf. Rejected: an `input` for a checkbox. Rejected: editing the file from the sidebar. Rejected: rendering the issue body. Rejected: calling the renderer from Tasks or the focus block in this change.

## Open decisions

none
