## Verification boundary

### issue-description

The scenarios are observed on the window: the sidebar of a cycle in the pool, read with the title, and the spine of a taken cycle.

The description block is the author's text outside `<!-- sdd:begin -->` and `<!-- sdd:end -->` on the issue body the tracker already returned. An empty description leaves no block. A cycle that has left the pool has no description block. The spine of a taken cycle stays as it is.

One file: `pnpm test -- <test-file>`
Layer: `pnpm test`
Fast suite: none

Type check: `pnpm run test:types`
Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
Test path: `src/**/*.test.ts` or `src/**/*.test.tsx`

## External contracts

none

## Technical prerequisites

none

## Approach

The description is one more sidebar block. The drawer already draws the open cycle; this block sits under the title, before the reason, and it is text. It has no field and no pill, so the face gains no colour role.

`WindowTicket.body` is the issue body the tracker already returned. `sidebar()` asks `slotOf` the same way the board does, and passes that the cycle is in the pool into `blocksFor`. `blocksFor` adds the block only then. The client draws the block and does not parse the body.

The author's text is the body with one complete pair, from `<!-- sdd:begin -->` through `<!-- sdd:end -->`, removed. A missing pair leaves the whole body. Whitespace alone leaves no block. Text before the pair and text after it both stay.

The spine keeps reading the mirror inside that pair through `linesFromIssue`. A taken cycle does not gain this block, and its spine rows stay as they are. The mirror writer is untouched. The window does not fetch the body again and does not write it.

The risk is a second meaning of "in the pool", or a cut that eats the author's text when a marker is missing. Both stay on the existing seam: `slotOf` for the pool, and a complete marker pair for the cut.

Rejected: showing the author's text on a spine row; showing the block after the cycle leaves the pool; fetching the body when the sidebar opens; a separate sidebar reader for the pool.

## Open decisions

none
