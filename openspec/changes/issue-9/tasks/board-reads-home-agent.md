No home agent leaves the factory row

A home agent turns the board on

The layer agent leaves the factory row

## Source

`src/window/window.ts` keeps the board row, lamp (`stepsStart`), and Take on the home agent read, not the overlay agent.

`src/window/factory.ts` `agentRows` and `openHome.recorded`: the row `фабрике ещё нужен агент` when the home file names no agent; no row when the home file names an agent; overlay-only agent does not satisfy the board read.

Do not add a project agent or change which model a non-cursor overlay agent launches.

## Proof

`src/window/window.test.ts` observes `board().rows`, lamp, and Take when the home file has no agent, when it names an agent, and when only `агент слоя` names an agent. Tests may use window and home helpers in that file.

- `pnpm test src/window/window.test.ts`
- `pnpm test`
- `pnpm run test:types`
