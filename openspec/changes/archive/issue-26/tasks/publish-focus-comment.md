The skill of the phase writes this comment when the artifact is published
A focus comment is prose for one phase or the whole pull request
The first line is the marker sdd:focus:plan, sdd:focus:spec, sdd:focus:design, sdd:focus:tasks, sdd:focus:code, or sdd:focus
The layer ledger is not the comment a person reads
Older focus comments remain
The same text does not add another comment
No signal leaves the comment
No change file means no focus comment
The prose says what this phase produced
Something weak or that must be looked at is said too
Open questions are pointed at by place and count
A clean phase omits the weak-spot sentence
A phase with no open questions omits the pointer
There is no fixed heading the writer fills in

## Source

Seam: the tracker port posts focus prose; the machine observes signals and no longer builds a ledger comment; phase skills reach the tracker only through the `focus` sdd verb after Publish.

Stop `endStep` in `src/machine/focus.ts` from posting an `sdd:focus` ledger. Keep `observedSignal` and the rest of the step loop in `src/main.ts` unchanged aside from that seam.

Add the `focus` verb in `src/sdd.ts` and wire it through the machine tracker port: body is marker line plus prose, skip when the change directory is absent, skip when canonical body equals the latest focus comment, and never attach the layer ledger. Extend `isFocusRecord` and related helpers in `src/machine/marker.ts` so phase markers (`sdd:focus:plan` through `sdd:focus:code`) and whole-pull-request `sdd:focus` are focus comments; a focus marker is not a layer marker. Keep `sdd:layer=` grammar untouched.

Update `src/adapters/github.ts` (and its tests) so the adapter leaves a recognized focus marker as the first line, same rule as today for `sdd:focus`.

Update `skills/sdd-flow` step prompts so each phase skill calls `focus` from § Publish after the push when that phase's artifact is in the commit; the separate review step does not write focus.

Leave `src/window/**` and spine ledger parsing for a later slice. Leave `src/machine/phase.ts` phase movement unchanged in this slice.

## Proof

Test file: `src/machine/focus.test.ts`

Observes issue comments the tracker receives after a step run and after the `focus` verb: who writes focus, marker first lines, prose shape, deduplication, no post on no signal or no change file, and no layer-ledger body.

The test may read `src/machine/focus.test.ts`, `src/machine/focus.ts`, `src/machine/marker.ts`, `src/sdd.ts`, `src/adapters/github.ts`, and harness doubles already used in this file.

Commands that must exit 0:

`pnpm test -- src/machine/focus.test.ts`

`pnpm test`

`pnpm run test:types`
