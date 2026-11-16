- Plan and Design render the source as one markdown document
- A source line is not parsed as its own markdown document
- A covered line shows the node's value
- PlanLines stays the leaf
- data-line is the source line with trailing space removed and stays the draft key
- data-path is proposal.md or design.md under the change read path
- data-at is the source line number sectionsOf already assigns
- data-side is right
- A run of blank lines stays one span.gap
- A covered blank line stays the slice of the value

sdd-delta: 35e5e8fc15e0fb44

## Source

Add the shared renderer in `src/window/client/source-line.tsx`. It takes the `text` of the spine lines `PlanLines` was given, joined by newlines, and parses it with remark. Each painted node keeps remark `position.start` and `position.end` and the node's `value`. The renderer returns the node with that position and that value. Inline emphasis, a link, and code stay inside the block that contains them and keep their own positions. On an indented code block that spans several source lines, the raw indented first line is not in the node value; the first covered line shows the node's value and does not show the raw indented source, and each later covered line shows that line's slice of the value and does not show the previous line slice. A line the value does not contain does not show the raw source. A run of blank lines that no node covers stays one `span.gap`. A blank line the value contains stays that slice and is not one `span.gap`. The renderer does not read the spine, the draft, the pull request, or the review, and it does not set the data attributes.

In `src/window/client/sidebar.tsx`, `PlanLines` stays the leaf that renders the markdown document. It maps remark line `k` to `lines[k - 1]`. A source line is not parsed as its own markdown document and is not wrapped as one. The opening marker line and the closing marker line of a closed fenced code block do not show the raw source. For each covered line, `data-line` is that line's `text` with trailing space removed and is the draft key, `data-at` is that line's `line` from `sectionsOf`, `data-path` is `proposal.md` or `design.md` under the change read path, and `data-side` is `right`. The draft key is that source line, not the covered lines joined. Each covered source line, including the first covered line of an indented block, is its own comment target; that first line shows the node's value, and each later covered line shows that line's slice. The nodes stay one document. `PlanDocument` and `DesignDocument` still call only `PlanLines`.

Update `src/window/FACE.md` so a code span in the document joins the monospaced sentence. Leave remark click, `LineNote`, posted comments, section `h3`/`h4` lifting, Open questions wiring, no-pull-request `p.line`, and `reviewFold` outside the document to later slices. Leave Specify, Tasks, the focus block, and the issue body untouched.

Seams (no child issues): one-document render vs value slice vs `PlanLines` data attributes and gap vs `sectionsOf`/`partsOf` spine vs FACE copy vs remark and section chrome in later tasks.

## Proof

`src/window/source-line.test.ts` observes Plan and Design in the sidebar: the source renders as one markdown document, a source line is not parsed as its own markdown document, a covered line shows the node's value and marker lines do not show the raw source, `PlanLines` stays the leaf with the four data attributes on the rendered place, a run of blank lines is one `span.gap`, and a covered blank line in a fence is the value slice and not a `span.gap`.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/source-line.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.