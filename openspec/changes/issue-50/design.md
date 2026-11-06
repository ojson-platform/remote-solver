## Verification boundary

`phase-thread-accept`. The control's scenarios are observed on the rendered sidebar in `src/window/acceptance.test.ts`: on Plan, Specify, and Design, «Принять» stays in the gate's place; the control is inactive while this phase has an unclosed review thread; hovering it names the phase and says a thread on that phase is still open; a thread with no marker counts as this phase; a thread marked for a later phase does not count as this phase; a note does not count as this phase; an open question still leaves that place empty, as it does now. The machine not setting `sdd:wait-human` and not asking to accept the phase is observed in `src/machine/review-gate.test.ts`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`
fast suite: none
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts`, `src/**/*.test.tsx`
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

Depends: #49

## Approach

The hold is one predicate, `phaseThreadHolds`, in `src/machine/review.ts` next to `readReview`. The policy and the window both call it. Marker grammar stays in the machine. The marker is the reply token `markerName(parseMarker(body))`, the same token `threads` prints when no open-item pin applies. The pin still classifies a thread for rollback and for `threads --layer`. It does not decide this hold. A resolved thread is skipped, as `readReview` already skips it.

The writing phases are proposing, specifying, and designing. The window calls them Plan, Specify, and Design. The layers in order are `proposal`, `spec`, `design`, `tasks`, `code`.

The hold is true when an unclosed thread's reply marker is null, or is the layer of this phase. It is false for `note`, `fixed`, `begin`, `out`, a later layer, and an earlier layer.

`readReview` copies those reply markers onto `ReviewView` as `replies`. `reviewOf` keeps them. `emptyReview` and a hand-built view that omits `replies` hold nothing. The spy's reading goes through `readReview`, so production always has the list.

`decide` in `src/machine/policy.ts` keeps its earlier branches: an unanswered thread is still classified, an earlier marker still rolls back (ADR 0028), and a marker of the current layer still starts that layer's improve action. After those branches, on a writing phase, a hold does not return `reviewGate`. The decision is a wait with no `gate` and the reason `a thread on <phase> is still open`. An auto tag does not advance past that wait. `settle` drops `sdd:wait-human` from the labels while the hold is true. `openWait` in `src/machine/flow.ts` stays the only ask. It does not run, because the decision has no `gate`. A comment already posted stays on the issue. The label is what shows the ask, and the label is gone.

A note, a later-phase marker, `fixed`, `out`, and `begin` still reach the review gate. An earlier marker still rolls back. An open question or an open decision still leaves the place empty: `reviewReady` in `src/window/snapshot.ts` is false, so `layerAct` returns `none` before the hold is considered.

The window reads the same reply markers. `windowThread` in `src/window/live.ts` already stores `marker` from the latest body, and it also keeps `resolved` so the hold can skip a resolved thread. Drawing a thread on its line, or on the phase when it has no line, stays as #49 left it.

The open card's review is passed into `snapshot` from the same `review` the sidebar already reads in `src/window/window.ts`. `layerAct` returns `held` when it would have returned `accept` and the hold is true. `LayerAct` gains `held`. `hereControl` in `src/window/client/sidebar.tsx` draws the same «Принять» in the gate's place, with `disabled` and `title` `${name}: тред этой фазы ещё открыт`. The gate circle is not drawn in that place. `acceptReview` in `src/window/window.ts` returns that sentence and does not set the gate label. `accept` in the policy, the person's `sdd accept`, stays as it is.

No new colour. The control keeps the plaque's frame. `FACE.md` stays.

The window glossary names the inactive control. The machine glossary names the ask that is not posted. The context map records the seam: the window reads the review and does not settle the gate.

After merge the control and the gate follow the threads. No flag and no follow-up step.

Rejected: leaving the place empty while a thread of this phase is open. The control stays in the gate's place. Rejected: keying the control off `sdd:wait-human`. The label is absent while the thread holds, and the place would lose «Принять». Rejected: letting the open-item pin turn an unmarked reply into a later phase for this hold. Rejected: treating a note, a later phase, a resolved thread, `fixed`, `out`, or `begin` as this phase. Rejected: replacing the empty place an open question leaves with an inactive «Принять». Rejected: drawing threads, changing the unsent-remark queue, and changing the unanswered block. Rejected: blocking `sdd accept`. A person can still move the phase. The window control cannot.

## Open decisions

none
