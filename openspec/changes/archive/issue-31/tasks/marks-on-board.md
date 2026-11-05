Every card, in a column and in the pool, and the open sidebar show the same marks

A mark is a chip with a number

A mark is shown only when the other issue is on the board

A closed issue and a cancelled issue are absent, so they have no mark

A mark is direct

The issue that holds another lists that next issue, not the issues beyond it

When one issue is both a child and a blocker, the card shows both marks

## Source

Assume `host-issue-links` landed. Copy the four link fields in `src/window/live.ts`.

One function in `src/window/board.ts` builds three lists from the cards on the board, not from the open list and not from issues past the next one. Children are cards whose parent is this key and whose labels include `sdd:cycle`. Waits are cards named by `blockedBy` or `dependsOn`, one chip when both name the same issue. Holds are cards named by `blocks`. Each list is key order. The row is children, then waits, then holds. A child and a blocker that are the same issue produce both chips. A cancelled issue and a closed issue have no card, so they have no chip. The child card has no chip for its parent.

Wire `Ticket` in `src/window/client/board.tsx` and `Sidebar` in `src/window/client/sidebar.tsx` to render that mark list under the title with the issue key as the chip number. Same list on the column card, the pool card, and the open sidebar.

Leave chip kind styling, wrap rules, sidebar scroll pinning, reason block edits, and chip forms to later slices.

## Proof

Test file: `src/window/board.test.ts`

Observes the rendered window page: the same mark chips on a column card, a pool card, and the open sidebar; direct links only; no mark for off-board, closed, or cancelled targets; both chips when one issue is child and blocker; no parent chip on the child card.

May read `src/window/board.ts`, `src/window/live.ts`, `src/window/client/board.tsx`, `src/window/client/sidebar.tsx`, and the board test harness.

Commands that must exit 0:

```
pnpm exec vitest --run --reporter=default src/window/board.test.ts
pnpm test
```

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
