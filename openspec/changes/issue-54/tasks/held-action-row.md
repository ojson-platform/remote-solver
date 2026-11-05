design: `design.md` § Approach — `tick` in `src/machine/scheduler.ts` stops when the cap is full; `runSpy` in `src/main.ts` publishes the worker turn, the held set, and the settled decision; `src/window/live.ts` remembers them; the row in `publish` gains the held action token; the board port exposes phase beside action.

## Source

Walk ready agent decisions in `src/window/live.ts` (or extend existing turn memory) so refresh from the tracker does not drop the worker turn, each held action token, or the settled decision the spy just published. Wire `runSpy` / the board publish path so the parallel-cap row shows the held action beside `running`, and the port that returns the worker action also returns the phase the machine gave that worker.

Leave `liveFocus`, the sidebar live block, plaque sentence, pager index, and written focus pages untouched except imports or port shape a later task needs.

Seams (no child issues): spy memory vs tracker refresh; scheduler held set vs window live sentence; row action token vs live page text.

## Proof

`src/window/live.test.ts` observes the row showing a ready action waiting for a free slot beside the parallel cap.

- `pnpm exec vitest --run --reporter=default src/window/live.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
