## Verification boundary

The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

`task-mark`. Scenarios are observed on the task chip in the Tasks list of the sidebar, the span on each task summary. `A done task wears готово`, `A done task keeps готово`, `An open task wears открыто`, `An open task that is not the current one keeps открыто`, `The first open task wears открыто in the list during implementing`, `In Tasks, the first open task of a cycle in implementing shows the badge impl`, and `A cycle outside implementing has no impl badge` are that chip in the rendered sidebar. The list is already drawn in `src/window/spine.test.ts`. The Tasks row sentence keeps its own `impl` from the requirement this change does not modify; that sentence stays observed in `src/window/snapshot.test.ts` and is not these scenarios.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

`compact-mark`. Scenarios are observed on that same chip, on the spec badges `new`, `changed`, and `removed` in the capability summary, and on the face stylesheet. `impl, готово, открыто, and the spec badges new, changed, and removed share one compact mark` and `The mark stays one line, with smaller padding and no glow` are those words wearing one mark: the chip in the Tasks list, the capability badge rendered in `src/window/spec-diff.test.ts`, and the shared rule in `src/window/face.css`. The Tasks row's `impl` is the same word and wears that mark. The focus-block badge does not.

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

The window already has the seams. The machine and the adapters do not choose the word. The station is already on the spine. The chip is the listed task's short mark in the Tasks fold, drawn by the Tasks `SpineRow` in `src/window/client/sidebar.tsx`. `implTask` is the first task in `model.tasks` whose box is still open, the first `- [ ]` line. While `model.station` is `implementing`, that task's chip reads `impl` and does not read `открыто`. A done task reads `готово` and does not read `impl`. Any other open task reads `открыто`. Any other station leaves every open chip on `открыто` and puts `impl` on no listed task. `impl` is that chip, not a new control.

The Tasks row sentence stays `tasksSummary`. While the station is `implementing` and a task is open, the row still shows that task's id and `impl`. This change does not remove it. The list and the row no longer disagree on the first open task. A closed Tasks fold during `implementing` still hides the list chip; the row sentence stays the visible `impl`. The chip is in the fold markup.

The compact mark is one class, `compact`, on the six words: the task chip (`готово`, `открыто`, `impl`), the Tasks row's `impl`, and the capability summary badges `new`, `changed`, and `removed`. The task chip keeps `state`, and `done` when the word is `готово`, so the open ground stays brass and the done ground stays green. The spec badge keeps `badge` beside `compact`. The rule lives once in `src/window/face.css`: padding smaller than the current `2px 8px` on `.spine .task .state`, no `box-shadow`, and `white-space: nowrap`. The measure is recorded in `FACE.md` in the session that draws it. The Chip entry names `impl` on that first open task in that same session. Spec badges stay muted. They do not become chips.

`.focus-block .badge` is the marker line. It does not wear `compact`. `.spine .mark` stays the document highlight.

`FACE.md` today says the task chip wears the edge. That session drops the edge from this mark. The edge stays on the other controls that already wear it. No new colour.

Rejected: a badge per scenario. Rejected: a second word on the mark. Rejected: any task but the first open one, including the running set and the hammer. Rejected: taking `impl` off the Tasks row. Rejected: restyling the focus-block badge. Rejected: one ground for all six words. Rejected: reusing `.spine .mark`.

After merge the word is that chip and the mark is the stylesheet. No flag and no follow-up step.

## Open decisions

none
