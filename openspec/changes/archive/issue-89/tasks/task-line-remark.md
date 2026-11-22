- A click opens the remark draft
- The task file paints the remark draft the click stored

sdd-delta: 1b0f2ff7a883d440

## Source

On the task file source line: a click opens the remark draft for that line and does not open it for another line shown at the same time. `TaskFile` paints the remark draft the click stored, using `LineNote` the way a stored draft already uses elsewhere. The click listener in `src/window/client/main.tsx` still stores that draft; `Sidebar` already passes drafts into `TaskFile`.

Assume markdown paint, comment targets, no diff row, the `###` button, and the task path already hold from earlier slices.

Seams (no child issues): draft storage on the client in `main.tsx` versus `TaskFile` and `LineNote` in `sidebar.tsx`.

## Proof

`src/window/task-line.test.ts` observes the task file the change sidebar paints: a click on one source line opens the remark draft for that line and not for another; after the click the task file paints the remark draft that click stored.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/task-line.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.