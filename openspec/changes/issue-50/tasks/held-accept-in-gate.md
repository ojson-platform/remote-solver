- On Plan, Specify, and Design, «Принять» stays in the gate's place
- The control is inactive while this phase has an unclosed review thread
- Hovering it names the phase and says a thread on that phase is still open

sdd-delta: ab49d6f2d3c54c6f

## Source

When the Plan, Specify, or Design row would show acceptance and an open review thread counts for this phase (marker absent or matching this phase), `layerAct` in `src/window/snapshot.ts` returns `held` instead of `accept`. `LayerAct` gains `held`; `none` and `gate` stay as today. The window object exposes the same review reading `sidebar()` uses; the page passes it into the snapshot; a missing reading means no counting thread. The client does not match `sdd:` tokens.

`hereControl` in `src/window/client/sidebar.tsx` paints `held` as the same `accept-review` control in the gate's place: «Принять», `aria-label` `Принять ${name}`, `disabled`, `title` `${name}: нить этой фазы ещё открыта`. The active control keeps `Принять ${name}` and no such title. The row does not gain `data-gate`; the accept handler is unchanged. Do not set or clear `sdd:wait-human` and do not add a second gate in the machine; `decideOpen` in `src/machine/policy.ts` and `src/machine/review.ts` stays the source of withhold.

Extend `src/window/acceptance.test.ts` for these three scenarios on the rendered spine. Leave Tasks, Code, Accept rows, `FACE.md`, thread drawing, the unsent-remark queue, and the empty place an open question leaves untouched.

Seams (no child issues): `layerAct` held branch vs existing accept branch; snapshot review input vs live review store; inactive chrome vs machine withhold that already exists.

## Proof

`src/window/acceptance.test.ts` drives Plan, Specify, or Design on the open ticket with review threads staged per scenario: «Принять» stays in the gate's place, is inactive when a counting thread is open, and hover names the phase and says a thread on that phase is still open.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/acceptance.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
