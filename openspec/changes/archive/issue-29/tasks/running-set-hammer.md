The task that wears impl wears the hammer while the issue is in the running set

The hammer goes and the impl badge stays when the agent leaves the issue

An issue in the running set with no impl task shows no hammer

## Source

Carry the spy running set on each snapshot row when the snapshot is built, without storing it on the spine revision. `watchSpy` (`src/window/live.ts`) already publishes the set from `onRunning`; keep `leading(key)` for the pool icon in `src/window/board.ts` only. The hammer follows the row flag at paint, not the turn token (`SnapshotRow.action` / `fix-implementation` stays a separate seam). On start, publish the set before the snapshot is read; on leave, drop the issue from the set then note the cleared turn.

While the open cycle's station is `implementing`, the first open task in the drawer wears badge `impl` (first `- [ ]` in `tasks.md`; done tasks do not). The hammer mounts on that task summary only while the row flag is on. The Tasks fold stays closed with Code open; paint badge and hammer on the visible Tasks section row, not again inside the closed fold. No hammer on the plaque, pool tile, or Code row. A shell with no tasks yet has no impl task and no hammer. A running issue on another phase has no impl task and no hammer.

Edit `src/window/snapshot.ts`, `src/window/window.ts`, `src/window/client/sidebar.tsx`, and `src/window/client/frame.ts` as needed for the row flag and task summary. Update the window glossary in `src/window/CONTEXT.md` for the hammer name in the same session. Leave spine revision logic, board `lay`, and task file bodies in the fold untouched.

Seams (no child issues): running set vs turn action; hammer off the spine; `leading` for pool icon only; Tasks fold visibility vs summary paint.

## Proof

`src/window/snapshot.test.ts` drives the open cycle sidebar (hosted page or render harness the window tests already use) with `leading` toggled, implementing station, and `tasks.md` present. It observes the task summary on the visible Tasks row: hammer on the impl task while the issue is in the running set, hammer gone with impl badge kept after leave, and no hammer when there is no impl task though the issue is still leading. Tests may read snapshot JSON, rendered HTML, and harness helpers from existing window page tests.

- `pnpm exec vitest --run --reporter=default src/window/snapshot.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
