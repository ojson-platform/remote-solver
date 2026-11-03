The spine of a taken cycle stays as it is

## Source

Taken cycles must not gain the pool description block; spine rows for a taken cycle stay driven by `linesFromIssue` on the mirror inside the marker pair.

Leave `src/window/spine.ts`, `linesFromIssue`, and mirror write paths untouched. Verify regression in `src/window/spine.test.ts` (and adjust `src/window/sidebar.test.ts` only if a taken-cycle sidebar open would incorrectly show a description block).

## Proof

Test file: `src/window/spine.test.ts`

Observes projected spine lines for a taken cycle with an issue body that has author text outside the sdd markers and mirror lines inside: spine content matches the prior mirror-driven rows and is unchanged by the pool description feature.

May read: `src/window/spine.ts`, `src/window/spine.test.ts` helpers, `src/window/window.harness.ts`.

Commands that must exit 0:

- `pnpm test -- src/window/spine.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.

`pnpm run test:types`
