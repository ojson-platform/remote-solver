- While such a thread is open, the machine does not set sdd:wait-human and does not ask to accept the phase

sdd-delta: 1c5da6b86c1e0662

## Source

While a thread that counts for this phase is open and the row would show acceptance, the walk that posts the review-gate ask must not set `sdd:wait-human` and must not ask to accept the phase; a `sdd:wait-human` label that is already present stays.

Classify counting threads in `decideAhead` (`src/machine/decide/ahead.ts`) before the phase: unmarked threads and threads marked for this phase count; later-phase threads and notes do not. The ask runs through `openWait` in `src/machine/flow/step.ts` only when the decision is a wait that carries a gate and `sdd:wait-human` is absent — do not add a second gate. Remove the obsolete withhold requirement from observation; align `decideOpen` / review policy only as needed for this scenario. This withhold does not hold for a thread on an open question or an open decision, when the phase would pass without a person, or when the phase is sent back to write its document.

Extend `src/machine/decide/review-gate.test.ts` for this scenario with a counting thread open and «Принять» already inactive in the gate's place. Leave window `held` painting, thread drawing, the unsent-remark queue, and marker grammar in `src/machine/mark/review.ts` as other slices own them.

Seams (no child issues): `decideAhead` classification vs window counting; single `openWait` gate vs inactive chrome; existing `sdd:wait-human` label retention vs fresh withhold.

## Proof

`src/machine/decide/review-gate.test.ts` walks the review-gate post while a counting phase thread is open and acceptance is held in the gate's place: no new `sdd:wait-human`, no accept ask, and an existing label stays.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/machine/decide/review-gate.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
