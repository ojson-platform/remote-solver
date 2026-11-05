On the review gate for the proposal, the spec, the design, or accepting, the open page stays the written focus of that stop

Accepting keeps the written focus while checks are still running

The proposal gate keeps the written focus of that stop

The spec gate keeps the written focus of that stop

The design gate keeps the written focus of that stop

The ask block stays its own block and is not copied into the live page

The live sentence does not replace an ask

## Source

Extend `liveFocus` in `src/window/focus.ts` so `reviewGateForPhase` returns no live page while the proposal, spec, or design gate is on, or while accepting waits on a person or checks before merge; an archive worker on accepting keeps the gate off. Keep the ask as `kind: 'ask'` in `src/window/sidebar.ts` and do not copy ask prose into live text. With a gate or ask, the open page stays the latest written focus page.

Leave plaque live sentence and pager index return rules to their tasks unless a shared gate helper is needed here.

## Proof

`src/window/sidebar.test.ts` observes written focus staying open on each review gate, accepting with checks still running, ask remaining its own block, and live text not replacing the ask.

- `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
