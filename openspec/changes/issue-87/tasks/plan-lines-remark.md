- The line stays a comment target
- A click opens the remark draft on that line
- There is no diff row
- LineNote and posted line comments stay on that path and line

sdd-delta: 5203d0361d4326a4

## Source

In `src/window/client/sidebar.tsx`, `PlanLines` keeps the rendered place in the one document as the comment target when a pull request is present. With no pull request the place is not a comment target (the no-PR shape is finished in the chrome slice). It still paints `LineNote` and posted line comments on the path and line from `data-path` and `data-at`. The painted place is not a diff row. The comment target is not a button around a private document for that line.

In `src/window/client/main.tsx`, the document click listener still opens the remark draft from the place's `data-line`. When the click is on a comment target it prevents the default, so an anchor in the place does not navigate and the draft still opens.

Assume the one markdown document and the data attributes from the markdown slice. Leave Design Open-questions checkboxes, `##`/`###` section chrome, no-PR-only behavior, and phase foot placement to later slices.

Seams (no child issues): draft open path vs line comment paint vs anchor default prevention vs diff-row absence elsewhere in the window.

## Proof

`src/window/source-line.test.ts` observes that the rendered place stays a comment target, a click opens the remark draft on that source line, an anchor in the place does not navigate away, `LineNote` and posted comments stay on path and line, and the painted place is not a diff row.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/source-line.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
