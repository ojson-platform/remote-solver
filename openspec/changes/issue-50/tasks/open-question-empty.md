- An open question still leaves that place empty, as it does now

sdd-delta: ab49d6f2d3c54c6f

## Source

An open question, open decision, spec turn, missing baseline, or missing artifact still makes `layerAct` return `none` before counting threads; a counting thread must not place «Принять» in that empty slot. Verify on `proposal.md` open questions for Plan (and parallel rows as the harness already provides).

Extend `src/window/acceptance.test.ts` only for this emptiness case. Do not change checkbox or conversation behavior.

Seams (no child issues): open-question `none` branch vs held branch when a counting thread also exists; emptiness invariant vs new held chrome.

## Proof

`src/window/acceptance.test.ts` with an open question and a counting phase thread: the acceptance place stays empty, as today.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/acceptance.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
