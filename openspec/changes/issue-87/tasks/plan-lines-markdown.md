- Plan and Design render the source as one markdown document
- A source line is not wrapped as its own markdown document
- PlanLines stays the leaf
- data-line is the source line with trailing space removed and stays the draft key
- data-path is proposal.md or design.md under the change read path
- data-at is the source line number the rendered place came from
- data-side is right

sdd-delta: e878d73e50f8c514

## Source

Add the shared renderer in `src/window/client/source-line.tsx`. It takes the source of the one document and returns the nodes `PlanLines` paints. A source line is not parsed as its own markdown document and is not wrapped as one. Headings, lists, emphasis, links, and code render in that document. The function does not read the spine, the draft, the pull request, or the review, and it does not set the data attributes.

In `src/window/client/sidebar.tsx`, `PlanLines` stays the leaf that renders the markdown document. It does not call the renderer inside `p.line` or `button.line` for a private document of one line. It sets `data-line` to the source line the rendered place came from, with trailing space removed, `data-path` to `proposal.md` or `design.md` under the change read path, `data-at` to that line's number the rendered place came from (the number `sectionsOf` already stored), and `data-side` to `right`, and collapses a run of blank lines to one `span.gap`. A place that spans several source lines still exposes each source line it came from. `PlanDocument` and `DesignDocument` still call only `PlanLines`.

Update `src/window/FACE.md` so a code span in the document joins the monospaced sentence. Leave remark click, `LineNote`, posted comments, section `h3`/`h4` lifting, Open questions wiring, no-pull-request `p.line`, and `reviewFold` outside the document to later slices. Leave Specify, Tasks, the focus block, and the issue body untouched.

Seams (no child issues): one-document render vs `PlanLines` data attributes and gap vs `sectionsOf`/`partsOf` spine vs FACE copy vs remark and section chrome in later tasks.

## Proof

`src/window/source-line.test.ts` observes Plan and Design in the sidebar: the source renders as one markdown document, a source line is not wrapped as its own markdown document, `PlanLines` stays the leaf with the four data attributes on the rendered place, and blank runs collapse to one `span.gap`.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/source-line.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
