Opening the sidebar lands on now: the latest written focus, in full

The focus block sits directly under the title, above the reason and the ask

Chips stay in the header and do not scroll with the block

The reason, the ask, an unmarked review, and a hook stay their own blocks under the pager

## Source

Mount the focus pager as the first child of `.side-scroll` in `src/window/client/sidebar.tsx`, directly under the header and above the pool description, the reason, and the ask. Role verbs stay between those blocks and the spine. Keep chips as `LinkMarks` in the header; the header does not scroll with the pager.

In `src/window/sidebar.ts`, `blocksFor` keeps reason, ask, unanswered review, and hook as their own blocks under the focus blocks. The pager shows one page at a time: the badge is that comment's marker and the prose under it is the full prose for that page.

`WindowView` in the served path passes no page index so opening the sidebar and the first paint land on now (index 0). Record the pager as the first scrolling row and the chips in the header in `src/window/FACE.md` in the session that draws them; hairline pill measures stay in `face.css`.

Leave Back and Forward pills, client page index, written-focus comment walking, Accept caption, spine phase sentences, and scenario-name links to later tasks unless a minimal mount is required here.

Seams (no child issues): machine focus markers vs window rendering; server focus blocks vs client page index; pager placement vs chips in the header; open focus page vs Accept caption; spine phase sentence vs pager prose; prose scenario names vs `scenarioTarget` jumps.

## Proof

`src/window/board.test.ts` observes the rendered sidebar: opening lands on the latest written focus in full, the focus block sits directly under the title above the reason and the ask, chips stay in the header and do not scroll with the block, and the reason, the ask, an unmarked review, and a hook stay their own blocks under the pager.

- `pnpm exec vitest --run --reporter=default src/window/board.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
