## Verification boundary

`home-agent`. Scenarios are observed on the window: settings open, the home block, the home file, the board row, the lamp, Take, and `агент слоя` for one checkout.

one-file: `pnpm test -- <test-file>`
layer: `pnpm test`
fast suite: none
`pnpm test` runs `vitest --run` from `package.json`. CI runs that script as `pnpm test` and the type check as `pnpm run test:types`.
`pnpm run test:types`

## External contracts

none

## Technical prerequisites

none

## Approach

The window already has the seams this change uses. The face in `src/window/client/settings.tsx` draws the home block and the overlay group. `openHome` in `src/window/factory.ts` writes the home file. `openOverlay` writes `.aifactory/config.yaml` of the chosen checkout. `mergeFactory` is the merged factory the overlay fields read. The board row, the lamp, and Take read the home session's recorded agent. Page acts in `src/window/page.ts` are `choose-agent` and `add-role`. The known pairs stay the `PAIRS` table already in `factory.ts`. ADR 0029 stays: the board uses the cursor pair from home when the merged factory agent is cursor. A project agent that turns the board on while the home file has no agent stays out. A non-cursor overlay agent does not change the model the machine launches.

The home block gets its own `агент` select above the model fields. The select's value is empty until an agent is saved, so the list of `cursor`, `codex`, `claude-code`, and `opencode` includes a blank line for that empty value. Choosing an agent submits `choose-agent` at once. `openHome.chooseAgent` writes the home file with that agent's known pair. Choosing the agent the home file already records returns without a write, so a custom model, effort, and speed stay. Opening settings does not write the home file. The new-role form under Roles posts `add-role` and carries the role name, outcome, text, and `Добавить`. It has no agent field, so adding a role does not write the home agent.

`агент слоя` stays the overlay select for that one checkout. `openOverlay.chooseAgent` keeps the factory-config write. Changing `агент слоя` writes the new agent, the known pair, and the default effort and speed onto `.aifactory/config.yaml` of that checkout. A key the agent does not have stays absent. Old effort and speed keys do not remain. home-agent does not open a second write. When the home agent changes, and when `агент слоя` is empty, the overlay models, effort, and speed keep following the merged factory. Empty means the home agent. The overlay file stays out of the repository.

Rejected: leaving `агент` on the new-role form. Rejected: a second known-pair table. Rejected: rewriting the saved agent's pair when the same agent is chosen again. Rejected: a second write that leaves the overlay models on the merged factory when `агент слоя` changes.

## Open decisions

- [x] `openOverlay.chooseAgent` keeps the factory-config write. Changing `агент слоя` writes the new agent, the known pair, and the default effort and speed. A key the agent does not have stays absent. Old effort and speed keys do not remain. home-agent does not open a second write. The overlay models, effort, and speed keep following the merged factory when the home agent changes and when `агент слоя` is empty.
