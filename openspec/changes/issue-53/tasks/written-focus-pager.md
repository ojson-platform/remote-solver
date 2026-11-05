Back walks the older written comments, newest first, each in full

Forward returns toward now

Switching tickets lands on now for that ticket

While an older page is open and a new focus comment appears, the block returns to now

## Source

Keep the open page index in client memory in `src/window/client/main.tsx` beside the open layer. Index 0 is now. Wire Back and Forward as hairline pills on the focus block in `src/window/client/sidebar.tsx`, labeled «назад» and «вперёд», with `data-focus="back"` and `data-focus="forward"`. The click listener adjusts the index and redraws; it does not post. Hide Back on the oldest page, hide Forward on now, and hide both when only one page exists. Reset the index to 0 when the open ticket changes and when the newest written comment's body changes. Clamp an index past the end to the last page.

Leave machine markers, `writtenFocusPages`, Accept caption, spine sentences, and scenario links untouched unless a wiring fix is required for pager clicks.

## Proof

`src/window/sidebar.test.ts` observes Back, Forward, a ticket switch, and a new focus comment returning the block to now.

- `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
