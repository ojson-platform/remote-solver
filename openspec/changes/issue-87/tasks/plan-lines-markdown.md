- On each surface, every source line the leaf paints renders markdown (headings, lists, emphasis, links, and code)
- PlanLines stays the leaf
- data-line is the source line with trailing space removed and stays the draft key
- data-path is proposal.md or design.md under the change read path
- data-at is the source line number sectionsOf already assigns
- data-side is right
- A run of blank lines stays one span.gap

sdd-delta: 5203d0361d4326a4

## Source

Add `sourceLine` in `src/window/client/source-line.tsx`: one source line in, phrasing-only nodes out (`em`, `strong`, `code`, `a`, `span`); heading lines that still reach the leaf paint heading text without hash marks; one list line paints one item in a `span` with marker; emphasis, strong, inline code, and links replace markers; a fence line is `code` only for that line. The function does not read the spine, draft, pull request, or review and does not set data attributes.

In `src/window/client/sidebar.tsx`, `PlanLines` stays the leaf: it calls `sourceLine` inside `p.line` and `button.line` instead of the raw string, keeps `data-line` trimmed, `data-path` to `proposal.md` or `design.md` under the change read path, `data-at` from `sectionsOf`, `data-side` `right`, and collapses a run of blank lines to one `span.gap`. `PlanDocument` and `DesignDocument` still call only `PlanLines`.

Update `src/window/FACE.md` so a code span in a document line joins the monospaced sentence. Leave remark click, `LineNote`, posted comments, section `h3`/`h4` lifting, Open questions wiring, no-pull-request `p.line`, and `reviewFold` outside the document to later slices. Leave Specify, Tasks, the focus block, and the issue body untouched.

Seams (no child issues): `sourceLine` parsing vs `PlanLines` data attributes and gap vs `sectionsOf`/`partsOf` spine vs FACE copy vs remark and section chrome in later tasks.

## Proof

`src/window/source-line.test.ts` observes Plan and Design in the sidebar: each leaf line renders markdown kinds, `PlanLines` stays the leaf with the four data attributes on comment targets, and blank runs collapse to one `span.gap`.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/source-line.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
