Phase movement stays on sdd:layer= threads
Change takes no thread

## Source

Seam: phase movement stays on review threads marked `sdd:layer=`; focus comments and focus markers do not move the phase. Change is the change directory only and never carries its own layer thread.

Ensure `src/machine/phase.ts` and thread planting still derive movement only from `sdd:layer=` markers, not from focus comments. Ensure mirror naming from focus phase markers (`sdd:focus:spec` → Specify, and the other mirror pairs in the delta) is available where the machine or window maps markers to mirror rows without opening a Change thread when `openspec/changes/issue-<key>/` exists.

Touch `src/machine/marker.ts` only if focus markers need a shared helper with the mirror map. Leave focus posting and window display logic from earlier slices unless a test proves a conflict.

## Proof

Test file: `src/machine/marker.test.ts`

Observes marker parsing and mirror mapping: `sdd:layer=spec` keeps phase movement on layer threads, focus markers land on the correct mirror name, and the change directory does not gain a Change-layer thread.

The test may read `src/machine/marker.test.ts`, `src/machine/marker.ts`, `src/machine/phase.ts`, and existing marker harness patterns.

Commands that must exit 0:

`pnpm test -- src/machine/marker.test.ts`

`pnpm test`

`pnpm run test:types`
