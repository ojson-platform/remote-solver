Claude-code on the layer writes the overlay only

The layer agent remains the override for that one checkout

Clearing the layer agent shows the home agent

The overlay models, effort, and speed keep following the merged factory

A codex layer agent does not take home effort

No chosen checkout writes no overlay

The checkout overlay stays out of the repository

## Source

`src/window/client/settings.tsx`: `агент слоя` stays on the checkout overlay section with blank included; posts `choose-overlay-agent`.

`src/window/page.ts`: `choose-overlay-agent` writes the overlay only, not the home agent.

`src/window/factory.ts` `openOverlay` / `chooseAgent`: write `<checkout>/.aifactory/config.yaml` only; empty choice clears agent, models, effort, and speed; `mergeFactory` supplies home agent while overlay agent is empty; overlay agent with missing effort or speed uses that agent's default, not the home file; no chosen checkout writes nothing. When the checkout is a git repository, add `.aifactory/` to that checkout's `.git/info/exclude`. The machine without the window does not read the overlay.

`src/window/window.ts`: overlay session and settings fields follow merged factory rules above.

## Proof

`src/window/home-agent.test.ts` observes overlay file vs home file, settings merged fields, and repository exclude for `.aifactory/`, including layer-only claude-code with no home agent, home cursor with claude-code overlay, clearing overlay, codex overlay without home effort, and no write when no checkout is chosen. Tests may use window, overlay, and home helpers.

- `pnpm test src/window/home-agent.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
