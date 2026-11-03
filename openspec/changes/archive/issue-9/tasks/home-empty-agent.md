The field is empty until an agent is saved

## Source

Until the home file records an agent, the home block `агент` select shows empty (blank option in the list of `cursor`, `codex`, `claude-code`, `opencode`). Opening settings must not write the home file.

Edit `src/window/factory.ts` (`openHome` read path and agent field value). Edit `src/window/client/settings.tsx` for the empty select value. Board row `фабрике ещё нужен агент`, lamp `шаги стоят`, and Take disabled stay when the home file has no agent.

Leave overlay `агент слоя` and `openOverlay` unchanged in this slice.

## Proof

Test file: `src/window/factory.test.ts`

The test observes: no home file on disk after open settings only; home agent field empty; agent list complete; board row, lamp, and Take match the scenario when home has no agent.

May read: `src/window/factory.ts`, `src/window/window.ts`, `src/window/window.harness.ts`.

Commands (exit 0):

- `pnpm test -- src/window/factory.test.ts`
- `pnpm test`
- `pnpm run test:types`

`pnpm test` runs `vitest --run` from `package.json`. CI runs that script as `pnpm test` and the type check as `pnpm run test:types`.
