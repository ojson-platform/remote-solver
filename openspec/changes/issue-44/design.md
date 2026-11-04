## Verification boundary

`hammer`. Scenarios are observed on the station plaque of the cycle's board row and on the face stylesheet the page inlines. The plaque is where the phase and the running set are seen: `The hammer hangs on the plaque of the phase the worker is in`, `A worker improving a spec hangs the hammer on the specifying plaque`, `A worker archiving hangs the hammer on the accepting plaque`, `Any phase the running set is actually working gets the same mark`, `The hammer goes when the worker leaves`, `A cycle that is waiting for a person shows no hammer`, and `The plaque is the mark`. The Tasks row is where the hammer is absent and the `impl` badge stays: `The Tasks-row hammer does not stay beside the plaque` and `The hammer goes and the impl badge stays when the worker leaves`. The mark and the knock are seen on that same plaque and the stylesheet: `The mark stays one filled path while the worker stays`, `The hammer is the chosen mark`, `The filled path is M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`, and `The hammer knocks about 45 degrees and repeats while the worker stays`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

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

The hammer moves off the Tasks row and onto the plaque of the phase the worker is in. The window already draws that plaque. The machine, the reviewer, and the adapters stay as they are: the phase is the station the machine named, and the running set is the one the spy already hands the page.

`Plaque` in `src/window/client/board.tsx` is the brass card, drawn only when `row.station` is that column. Specifying, accepting, and every other phase share that one control. While `row.running` is set, the plaque mounts `HammerMark`. A worker improving a spec is the specifying station; a worker archiving is the accepting station; any other phase the running set is working is that same station. The svg sits inside the plaque button, `aria-hidden`, beside the lines `plaqueLines` already chose. It does not replace those lines, and the button stays the one open control. The line rules stay on `.reason`, `.stat`, and `.kicker`, so the mark is not clipped with them.

`row.running` is the spy's running set. `publish` in `src/window/snapshot.ts` already copies `surface.running`, and `watchSpy` (`src/window/live.ts`) fills that set from `onRunning`. The plaque reads the row at paint. On leave, the set drops the issue and the next row has no `running`, so the hammer unmounts. A cycle waiting for a person is not in that set, and its plaque stays bare. The `ask` line on a waiting plaque is not a second signal.

`tasksSummary` in `src/window/client/sidebar.tsx` drops `HammerMark`. The `impl` badge stays on the first open task while the station is `implementing`, including after the worker leaves. The badge does not depend on the running set. No hammer remains on that summary.

`HammerMark` in `src/window/client/marks.tsx` stays the chosen mark: one filled path, `d` `M2 4 H8 V8 H22 L26 12 L22 16 H8 V20 H2 Z M12 12 H16 V30 H12 Z`, `viewBox="0 0 32 32"`, ink `currentColor`, `transform-origin: 43.75% 93.75%` on the svg. The knock stays `hammer-knock` in `src/window/face.css`: about 45° around that origin, repeating, not a spin. The duration stays a measure there. Today the rule is `.spine svg.hammer.mark`, and `.spine .mark` is a brass chip the hammer resets. The plaque is not inside `.spine`, so the knock rule moves with the mark onto the plaque and keeps `background: none`. `FACE.md` records the mark on the plaque in the same session. The window glossary names the hammer as that mark on the plaque, and names that it leaves when the worker leaves while the `impl` badge stays.

The pool tile does not mount the mark. `Corner` and the pool gutter stay without it. A pool row that has a station still uses the station plaque; the tile is not that plaque.

Rejected: leaving the hammer on the Tasks row. Rejected: a second hammer on the task summary. Rejected: a hammer on the pool tile, the take circle, a door, or a gate. Rejected: a per-phase mark, or keying the hammer off the action token or off `sdd:wait-human`. Rejected: storing the hammer in the spine. Rejected: a second path, a stroke, or `evenodd`.

After merge the mark is that plaque and the stylesheet. The Tasks row keeps the badge and shows no hammer. No flag and no follow-up step.

## Open decisions

none
