The Tasks-row hammer does not stay beside the plaque

The hammer goes and the impl badge stays when the worker leaves

## Source

Drop `HammerMark` from `tasksSummary` in `src/window/client/sidebar.tsx`. The `impl` badge stays on the first open task while the station is `implementing`, including after the worker leaves. The badge does not depend on the running set. No hammer remains on that summary.

Assume `hammer-plaque` already mounts the hammer on the station plaque while `row.running` is set. Leave plaque paint, `HammerMark` path and viewBox, and face stylesheet knock rules to `hammer-mark-plaque`. Leave spine revision logic and task file bodies in the fold untouched.

## Proof

`src/window/snapshot.test.ts` drives the open cycle sidebar with `leading` toggled, implementing station, and `tasks.md` present. It observes the task summary on the visible Tasks row: no hammer beside the plaque while the worker is busy, `impl` badge kept after the worker leaves, and no hammer on the summary when the hammer hangs on the plaque.

- `pnpm exec vitest --run --reporter=default src/window/snapshot.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
