- Each source line renders headings, lists, emphasis, links, and code

sdd-delta: 1b0f2ff7a883d440

## Source

In `src/window/client/sidebar.tsx`, `TaskFile.paint` calls `paintSourceDocument` from `src/window/client/source-line.tsx` on the source lines it already paints. Each source line renders a heading, a list, emphasis, a link, and code as markdown. `TaskFile.paint` does not copy a second parser. It does not call `partsOf`.

Leave comment targets, diff-row absence, a `###` line as button, the task path, remark draft storage in `src/window/client/main.tsx`, and painting the stored draft with `LineNote` to later slices. Leave Plan, Design, Specify, the focus block, editing the file from the sidebar, a second document viewer, and issue-body rendering untouched.

Seams (no child issues): shared `paintSourceDocument` in `source-line.tsx` versus `TaskFile.paint` in `sidebar.tsx`.

## Proof

`src/window/task-line.test.ts` observes the task file the change sidebar paints: source lines that contain a heading, a list, emphasis, a link, and code render each of those as markdown.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/task-line.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.