The row, the lamp, and Take read the home agent

A layer agent does not turn the board on

## Source

Board wiring in `src/window/window.ts` and related board helpers: while the home file has no agent, the row is `фабрике ещё нужен агент`, the lamp reads `шаги стоят`, and Take does not write the assignee. The lamp reads `шаги идут` only when the home agent answers and both home models are filled. Choosing `агент слоя` alone must not remove the row or light the lamp.

Do not add a project agent or change machine launch models from overlay in this slice.

## Proof

`src/window/home-agent.test.ts` observes `board.rows`, lamp state, and Take behavior with no home agent and with only a layer agent set. Tests may use the window surface and board helpers.

- `pnpm test src/window/home-agent.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
