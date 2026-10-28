Activating the key follows the link and does not open the sidebar

Activating the key follows the link and does not close the sidebar

## Source

When a repository is named, put the key in an anchor beside the title open button so activating the key follows the issue href and does not post `open`. Keep the title in the existing open control.

May edit: `src/window/page.ts`, `src/window/client/board.tsx`, `src/window/client/forms.tsx` when needed for markup only.

Leave unchanged: title open and close behavior, take control, issue href construction from the prior task, station plaque and door.

## Proof

Test file: `src/window/page.test.ts`

The test activates the gutter key on a drawn row with and without the sidebar open for that cycle and checks navigation to the issue page, sidebar state, and that the cycle is not taken.

The test may read files under `src/window/` that the page layer already uses for board fixtures.

Commands:

- `pnpm test -- src/window/page.test.ts`
- `pnpm test`
- `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`. The spec id is the capability id, and the scenario name is the scenario title.
