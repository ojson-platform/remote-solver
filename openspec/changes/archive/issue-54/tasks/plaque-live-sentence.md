On a review gate the plaque does not take the live sentence

The plaque shows the same live sentence as the open page

That sentence leaves when the reason passes

The Done count stays when no live reason applies

The narrow Waits for line is only the child wait at tasking

## Source

In `src/window/board.ts` `plaqueLines`, pass the live sentence only when `liveFocus` returned one, the ticket has no ask, and no review gate is on; use it as plaque text instead of the phase row. When absent, keep `Done <done>/<done+open>` on implementing and leave `childWaits` as the narrow `Waits for` keys at tasking without naming blockers, until-phase, workers, cap, or checks. The hammer still mounts from `running`.

Leave sidebar live block and pager index untouched except shared `liveFocus` calls.

## Proof

`src/window/board.test.ts` observes the plaque live sentence matching the open page, leaving when the reason passes, Done count when no live reason, narrow Waits for at tasking only, and no live sentence on a review gate.

- `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
