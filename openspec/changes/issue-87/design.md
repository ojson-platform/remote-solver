sdd-absorbed: dbe3f0857eea4c29

## Verification boundary

`source-line`. Scenarios are observed on the Plan and Design documents the sidebar paints, in `src/window/source-line.test.ts`. Plan and Design render the source as one markdown document. Headings, lists, emphasis, links, and code render on the source line the painted place came from. A source line is not parsed as its own markdown document and is not wrapped as one. A covered line shows the node's value. A line the value does not contain does not show the raw source. The body line of a closed fenced code block whose body is `const x = 1` shows that value, and the opening marker line and the closing marker line do not show the raw source. The source line a rendered place came from stays a comment target. A click on a rendered place that came from one source line opens the remark draft on that source line and does not open it on another painted source line. The painted place is not a diff row. `PlanLines` stays the leaf that renders the markdown document. `data-line` is the source line the rendered place came from, with trailing space removed, and stays the draft key. `data-path` is `proposal.md` or `design.md` under the change read path. `data-at` is the source line number the rendered place came from, the number `sectionsOf` assigns. `data-side` is `right`. `LineNote` and posted line comments stay on that path and line. On Design, `model.design.questions` is passed only for Open questions, and a checkbox outside Open questions stays a line comment. A `##` line stays the section `h3`, not a button. A `###` line stays the `h4` from `partsOf`, not a button. A run of blank lines that no node covers stays one `span.gap`. A blank line that a code node covers stays the slice of that value, because the value contains that empty line, and stays a comment target. It is not one `span.gap`. With no pull request, the line stays a `p.line` and is not a comment target. The phase foot stays outside the document. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter. `pnpm test` is the CI run of the package script `vitest --run`.

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

Plan and Design render the source as one markdown document. `PlanLines` is the leaf that renders it. A source line is not parsed as its own markdown document and is not wrapped as one. Headings, lists, emphasis, links, and code render on the source line the place came from, in that document. A covered line shows the node's value. A line the value does not contain does not show the raw source. `sectionsOf` in `src/window/spine.ts` still assigns the source line number. `PlanLines` reads the remark position and puts that number on the painted place as `data-at`. A `##` line is the section `h3` in that document, not a button. `partsOf` in `src/window/client/sidebar.tsx` still supplies the `h4` for a `###` line, and that line is not a button. `PlanDocument` and `DesignDocument` still call only `PlanLines`.

The shared renderer lives in `src/window/client/source-line.tsx`. It takes the source of the one document, the `text` of the spine lines `PlanLines` was given, in that order, joined by newlines, and parses it with remark. Each painted node keeps the remark source position, `position.start` and `position.end`, 1-based line and column in that string, and keeps the node's value. The renderer returns the node with that position and that value. Inline emphasis, a link, and code stay inside the block that contains them and keep their own positions. A covered line is a source line the node's value contains, and that line shows the slice of the value. A line the value does not contain does not show the raw source. A run of blank lines that no node covers stays one `span.gap`. The renderer does not read the spine, the draft, the pull request, or the review, and it does not set the data attributes. Later surface children call this renderer. This cycle, `PlanLines` is the leaf.

`PlanLines` maps those positions onto the spine lines it passed in. Remark line `k` is `lines[k - 1]`. The opening marker line and the closing marker line of a closed fenced code block do not show the raw source. The body line of a block whose body is `const x = 1` shows that value. For each covered line, `data-line` is that line's `text` with trailing space removed and is the draft key, `data-at` is that line's `line`, the number `sectionsOf` already stored, `data-path` is `proposal.md` or `design.md` under the change read path, and `data-side` is `right`. A place whose value contains several source lines gets one comment target per covered source line, around the slice of the value on that line. A blank line the value contains stays that slice and a comment target, and it is not one `span.gap`. The nodes stay one document. The draft key is that source line, not the covered lines joined. The click listener reads `data-line` from the innermost target under the click, so the draft opens on the source line that place came from and does not open on the other source line.

`PlanLines` matches an open question against the raw line, paints `LineNote`, and paints the posted comments on that path and that `data-at`. It collapses a run of blank lines that no node covers to one `span.gap`. On Design, Open questions still receives `model.design.questions`. Every other section still receives an empty list, so a checkbox outside Open questions stays a line comment. The phase foot stays `reviewFold`, a sibling after the document, not inside `.doc`.

Specify does not call the renderer. The spec section is not painted through this leaf. Tasks and the focus block do not call the renderer. The issue description does not either.

The document click listener in `src/window/client/main.tsx` still opens the remark draft from the place's `data-line`. When the click is on a comment target it prevents the default, so the draft opens on the source line that place came from. With no pull request the line stays a `p.line`: there is no listener and the place is not a comment target.

A checkbox outside Open questions stays a line comment on the raw line. A `##` line and a `###` line stay `h3` and `h4`, not buttons.

No new colour, ground, measure, or control name. A code span in the document uses the monospaced face the type already gives a key, a path, and a capability name. The drawing session adds that span to the monospaced sentence in `src/window/FACE.md`. `CONTEXT.md` does not gain a word: the line is still the document line, and choosing it still opens the field.

After merge, Plan and Design paint the source as one markdown document through `PlanLines`. A covered line shows the node's value, and each source line a place covers stays the comment target of that line. No flag and no follow-up step.

Rejected: parsing or wrapping each source line as its own markdown document. That cannot render headings, lists, and code as one document. Rejected: showing the raw source on a line the node's value does not contain. Rejected: collapsing a blank line the value contains into one `span.gap`. Rejected: copying `data-at` from `sectionsOf` onto the painted nodes with no mapping from the place back to those lines. Rejected: a diff row beside a source line on Plan and Design. Rejected: a second document viewer, and a library that replaces `PlanLines` as the leaf. Rejected: an `input` for a checkbox. Rejected: a button around a private document for that line. Rejected: editing the file from the sidebar. Rejected: rendering the issue body. Rejected: calling the renderer from Specify, Tasks, or the focus block, and painting the spec section through this leaf.

## Open decisions

none
