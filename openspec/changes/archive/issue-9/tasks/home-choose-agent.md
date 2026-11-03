Choosing an agent writes the home file at once with that agent's known pair

Choosing codex writes its known pair at once

Choosing a different agent writes that agent's known pair at once

## Source

Choosing an agent on the home block `агент` submits `choose-agent` at once. `openHome.chooseAgent` writes the home file with that agent and the known pair from `PAIRS` in `src/window/factory.ts`. When the home file had no agent, clear board row `фабрике ещё нужен агент` and set lamp `шаги идут`. Switching from one saved agent to another rewrites agent and pair; effort and speed follow the new agent's defaults (absent keys stay absent).

Edit `src/window/factory.ts`, `src/window/page.ts`, and `src/window/client/settings.tsx` as needed for the home-field submit path. Do not change overlay `агент слоя` write semantics here.

## Proof

Test file: `src/window/factory.test.ts`

The test observes home file on disk after choosing `cursor`, `codex`, and switching from `cursor` to `codex`: agent, mechanical, judgment, effort, speed, board row, and lamp per the three scenarios.

May read: `src/window/factory.ts`, `src/window/window.ts`, `src/window/window.harness.ts`.

Commands (exit 0):

- `pnpm test -- src/window/factory.test.ts`
- `pnpm test`
- `pnpm run test:types`

`pnpm test` runs `vitest --run` from `package.json`. CI runs that script as `pnpm test` and the type check as `pnpm run test:types`.
