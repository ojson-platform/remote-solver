A named repository makes the key a link to the issue

No repository leaves the key as text

## Source

Build the issue page href from `WindowTicket.repo` and the cycle key on the board model, carry it on the snapshot row, and draw the gutter key as a link with class `key` when the href is present or as text inside the title open control when it is absent. Copy the href onto pool and column cards as the design describes.

May edit: `src/window/board.ts`, `src/window/types.ts`, `src/window/snapshot.ts`, `src/window/client/board.tsx`.

Leave unchanged: splitting the key from the title button, sidebar open/close routing, station plaque and station door, take control, pool drag.

## Proof

Test file: `src/window/page.test.ts`

The test drives a drawn board row and reads the HTML for the gutter key: link target and presence of an anchor versus plain text in the title control.

The test may read files under `src/window/` that the page layer already uses for board fixtures.

Commands:

- `pnpm test -- src/window/page.test.ts`
- `pnpm test`
- `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`. The spec id is the capability id, and the scenario name is the scenario title.
