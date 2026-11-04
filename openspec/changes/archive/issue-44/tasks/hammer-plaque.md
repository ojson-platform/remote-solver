The hammer hangs on the plaque of the phase the worker is in

A worker improving a spec hangs the hammer on the specifying plaque

A worker archiving hangs the hammer on the accepting plaque

Any phase the running set is actually working gets the same mark

The hammer goes when the worker leaves

A cycle that is waiting for a person shows no hammer

The plaque is the mark

## Source

Mount `HammerMark` on `Plaque` in `src/window/client/board.tsx` while `row.running` is set. The plaque is the brass card drawn only when `row.station` is that column; specifying, accepting, implementing, and every other phase share that one control. Place the svg inside the plaque button, `aria-hidden`, beside the lines `plaqueLines` already chose. It does not replace those lines, and the button stays the one open control. The line rules stay on `.reason`, `.stat`, and `.kicker`, so the mark is not clipped with them.

`row.running` is the spy's running set. `publish` in `src/window/snapshot.ts` already copies `surface.running`, and `watchSpy` (`src/window/live.ts`) fills that set from `onRunning`. The plaque reads the row at paint. On leave, the set drops the issue and the next row has no `running`, so the hammer unmounts. A cycle waiting for a person is not in that set, and its plaque stays bare. The `ask` line on a waiting plaque is not a second signal.

The pool tile does not mount the mark. `Corner` and the pool gutter stay without it. A pool row that has a station still uses the station plaque; the tile is not that plaque.

Leave the machine, the reviewer, the adapters, `tasksSummary` in `src/window/client/sidebar.tsx`, `HammerMark` drawing in `src/window/client/marks.tsx`, and knock rules in `src/window/face.css` to later tasks unless a minimal mount import is required here.

Seams (no child issues): running set vs turn action; hammer on the plaque vs the Tasks row; `leading` for the pool icon only; waiting `ask` vs hammer; pool tile vs station plaque; knock selector spine vs plaque.

## Proof

`src/window/board.test.ts` drives the hosted page with `leading` toggled and stations across phases. It observes the station plaque HTML: hammer on the plaque of the phase the worker is in (specifying, accepting, implementing, and other working phases), no hammer when the worker leaves or the cycle waits for a person, and the plaque as the mark location.

- `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
