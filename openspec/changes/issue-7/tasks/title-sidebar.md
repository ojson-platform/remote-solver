The first activation of the title opens the sidebar

A second activation of the title closes the sidebar

## Source

Keep the title on the open control after the key stands outside it when a repository is named. Activating the title posts `open` for that cycle and toggles the sidebar without taking the cycle.

May edit: `src/window/page.ts`, `src/window/client/board.tsx`.

Leave unchanged: key link and key activation from prior tasks, take control, station plaque and door.

## Proof

Test file: `src/window/page.test.ts`

The test activates the title on a drawn row with the sidebar closed then open and checks sidebar state and that the cycle is not taken.

The test may read files under `src/window/` that the page layer already uses for board fixtures.

Commands:

- `pnpm test -- src/window/page.test.ts`
- `pnpm test`
- `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`. The spec id is the capability id, and the scenario name is the scenario title.
