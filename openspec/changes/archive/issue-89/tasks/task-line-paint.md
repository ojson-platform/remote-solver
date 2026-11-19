- The line stays a comment target
- There is no diff row
- A level-three heading stays a button
- The path stays the task file

sdd-delta: 1b0f2ff7a883d440

## Source

In `src/window/client/sidebar.tsx`, `TaskFile.paint` keeps each source line a comment target, paints no source line as a diff row, keeps a `###` source line a button without calling `partsOf`, and keeps the path `<readPath>/tasks/<id>.md`.

Assume `paintSourceDocument` already renders markdown on each line. Do not reopen that parser path except where paint structure must change for these checks.

Leave remark draft open on click and `LineNote` painting of the stored draft to the later slice. Leave the click listener in `src/window/client/main.tsx`, Plan, Design, Specify, the focus block, sidebar file edit, a second document viewer, and issue-body rendering untouched.

Seams (no child issues): `TaskFile.paint` row structure in `sidebar.tsx` versus shared line paint in `source-line.tsx`.

## Proof

`src/window/task-line.test.ts` observes the task file the change sidebar paints: each source line stays a comment target; no source line is a diff row; a `###` line stays a button; opening a task from the sidebar shows the path `<readPath>/tasks/<id>.md`.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/task-line.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.