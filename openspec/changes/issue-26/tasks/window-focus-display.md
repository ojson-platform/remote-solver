The sidebar focus block shows the latest marker as a badge and the prose under it
The spine row of that phase keeps the first sentence of its own latest phase comment
A whole-pull-request comment belongs to the focus block and to no single row
A manager comment is not the focus block

## Source

Seam: the window reads issue comments only; it does not recompute focus prose from files or from the old ledger shape. Depends on `publish-focus-comment` for marker lines and prose on comments.

Replace ledger-style parsing in `src/window/focus.ts`, `src/window/sidebar.ts`, and `src/window/spine.ts` with the latest focus comment's marker badge and prose body. Skip manager comments, asks, and role outcomes when choosing the focus block. Spine rows take the first sentence of the latest comment for that phase marker; `sdd:focus` whole-pull-request prose stays on the focus block only. Keep legacy ledger-shaped `sdd:focus` bodies working only where the delta still requires the gap-line exception in design (marker `sdd:focus` with mirror layer lines).

Update sidebar block types and drawer rendering in `src/window/types.ts` and `src/window/client/frame.ts` so the badge shows the marker and prose sits under it. Touch `src/window/snapshot.ts` only if the live snapshot must carry the marker. Update `src/window/FACE.md` when badge or focus block measures change.

Leave `endStep`, the `focus` verb, and `src/machine/focus.ts` posting logic untouched in this slice.

## Proof

Test file: `src/window/sidebar.test.ts`

Observes the sidebar focus block and spine row sentences through the window harness: latest phase marker and prose, manager skip, and whole-pull-request comment not applied to a single spine row.

The test may read `src/window/sidebar.test.ts`, `src/window/spine.test.ts`, `src/window/window.harness.ts`, `src/window/focus.ts`, `src/window/sidebar.ts`, and `src/window/spine.ts`.

Commands that must exit 0:

`pnpm test -- src/window/sidebar.test.ts`

`pnpm test`

`pnpm run test:types`
