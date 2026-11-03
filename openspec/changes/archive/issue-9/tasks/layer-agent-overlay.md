An overlay agent leaves the factory needing an agent

агент слоя remains the override for that one checkout

Empty means the home agent

Choosing cursor on агент слоя writes the known pair and drops old effort and speed

The overlay models, effort, and speed keep following the merged factory

The checkout overlay stays out of the repository

## Source

Keep `агент слоя` as the per-checkout override via `openOverlay.chooseAgent` writing `.aifactory/config.yaml` of the chosen checkout only. That write must not set the home agent. When the home file has no agent, board row, lamp, and Take stay as when no factory agent is configured. Empty `агент слоя` means the home agent; while empty, overlay model, effort, and speed fields follow `mergeFactory`. Changing `агент слоя` writes the new agent, known pair, and default effort and speed; drop keys the agent lacks and remove stale effort and speed keys. Overlay file stays out of the repository.

Edit `src/window/factory.ts` (`openOverlay`, `mergeFactory`), `src/window/client/settings.tsx` (overlay group), and `src/window/page.ts` if the overlay `choose-agent` target differs from the home field. Do not add a second known-pair table.

## Proof

Test file: `src/window/factory.test.ts`

The test observes overlay disk file, home file, board, lamp, Take, settings overlay fields, and git cleanliness for the six scenarios.

May read: `src/window/factory.ts`, `src/window/window.ts`, `src/window/window.harness.ts`, `src/window/factory-config.test.ts` (harness patterns only).

Commands (exit 0):

- `pnpm test -- src/window/factory.test.ts`
- `pnpm test`
- `pnpm run test:types`

`pnpm test` runs `vitest --run` from `package.json`. CI runs that script as `pnpm test` and the type check as `pnpm run test:types`.
