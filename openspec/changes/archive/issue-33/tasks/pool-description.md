A cycle in the pool shows its issue description in the sidebar

The person reads the issue description when choosing a ticket, along with the title

The description is the issue body the tracker already returned, the author's text outside the markers

## Source

Add a sidebar description block for cycles in the pool only. The block is plain text under the title and before the reason; no field, pill, or new face colour role.

Edit `src/window/sidebar.ts`: derive the author's text from `WindowTicket.body` by removing one complete `<!-- sdd:begin -->` … `<!-- sdd:end -->` pair when both markers exist; a missing pair keeps the whole body; whitespace-only author text yields no block. Extend `blocksFor` to accept whether the open cycle is in the pool (via the same `slotOf` seam the board uses) and prepend a `{kind: 'description', text}` block only in the pool case when author text is non-empty.

Edit `src/window/window.ts` `sidebar()` to pass pool membership into `blocksFor`. Edit `src/window/types.ts` for the new `SidebarBlock` variant. Edit `src/window/client/sidebar.tsx` to render the description block as text without parsing the body.

Leave `src/window/spine.ts`, `linesFromIssue`, the mirror writer, issue fetch paths, and taken-cycle spine rows untouched.

## Proof

Test file: `src/window/sidebar.test.ts`

Observes `window.sidebar()` and rendered sidebar HTML for a pool cycle: the description block sits with the title when choosing a ticket, and the text matches the issue body with the sdd marker pair stripped while text inside the pair does not appear in the block.

May read: `src/window/sidebar.ts`, `src/window/window.ts`, `src/window/window.harness.ts`, `src/window/types.ts`, `src/window/client/sidebar.tsx`, `src/window/board.ts` (`slotOf`).

Commands that must exit 0:

- `pnpm test -- src/window/sidebar.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.

`pnpm run test:types`
