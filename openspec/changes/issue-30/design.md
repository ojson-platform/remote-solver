sdd-absorbed: a169b9231cd8dbdf

## Verification boundary

`compact-mark` and the modified `task-chip`.

`task-chip` is observed on the rendered Tasks row of the open ticket, in `src/window/spine.test.ts`. On a cycle in `implementing`, the row shows `impl` beside the id of the earliest task that is not done, and beside no other task. A done task shows `готово`. An open task shows `открыто` on its own mark, including the task the row marks `impl`. A cycle with no open task shows no `impl`. A cycle that is not in `implementing` shows no `impl`, and still shows `готово` and `открыто`.

`compact-mark` is observed on that same drawer, in `src/window/spine.test.ts`, with the shared rule read from `src/window/face.css`. The words `impl`, `готово`, `открыто`, `new`, `changed`, and `removed` are visible together. Each wears the one compact mark: padding smaller than the task chip's `2px 8px`, no glow, and one line.

The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter. `pnpm test` is the CI run of the package script `vitest --run`. The type check is the CI run of `pnpm run test:types`.

`task-chip` one-file: `pnpm exec vitest --run --reporter=default <test-file>`
`task-chip` layer: `pnpm test`
`compact-mark` one-file: `pnpm exec vitest --run --reporter=default <test-file>`
`compact-mark` layer: `pnpm test`

fast suite: none
`pnpm run test:types`
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts` or `src/**/*.test.tsx`

## External contracts

none

## Technical prerequisites

none

## Approach

The window already carries the station, the task list, and each capability's badge. `SpecBadge` in `src/window/spec-diff.ts` stays `new`, `changed`, or `removed`. This change does not choose a badge and does not reorder tasks.

The selection stays in `tasksSummary` in `src/window/client/sidebar.tsx`. `implTask` is the earliest task in `model.tasks` that is not done. The Tasks row paints that id and the word `impl` only when `model.station` is `implementing` and such a task exists. Otherwise the row keeps the Tasks sentence and shows no `impl`. Each task summary stays its own node: `готово` when `task.done`, `открыто` otherwise. The task the row marks `impl` still shows `открыто` on that node.

The six words share one compact mark. The task chip is `.spine .task .state` in `src/window/face.css`: padding `2px 8px`, a fill, and an inset glow. `открыто` is brass and `готово` is green. `impl` and the spec badges are `.spine .badge`: muted, no padding, no glow, already one line. Those two selectors take one shared rule: padding smaller than `2px 8px`, no `box-shadow`, and `white-space: nowrap`. The task chip keeps its fill, its brass, its green, and a radius that is not a pill, so it stays the short chip the drawer already draws. `impl` and the spec badges stay muted and take that same padding. No new colour and no new ground.

`FACE.md` records the look in the same change: these six words are one compact mark, and the task chip does not wear the edge. The focus block's badge stays the monospaced marker it is. A link chip stays the short chip it is. The hammer stays on the plaque. The glossary chip remains the open or done word.

Rejected: leave the glow on the task chip and shrink only the spec badges. The six words share the mark, so the task chip loses the glow. Rejected: restyle every element with `class="badge"`. The focus block's badge sits outside `.spine` and is a phase marker or a live word. Rejected: one fill and one colour for all six words. Colour stays the role each word already has. Rejected: a second word on the mark, a badge per scenario, and any open task other than the first. Rejected: choosing the task in the machine or in the spec diff. The window already has the list and the station.

After merge the mark is the window's paint. Nothing manual remains.

## Open decisions

none
