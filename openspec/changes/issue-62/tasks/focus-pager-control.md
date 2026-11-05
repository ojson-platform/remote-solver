One control on the focus row, opposite the badge, shows a back chevron, the current page and the count, and a forward chevron, in the form `< 11/12 >`

The count runs from the oldest page, so the latest page reads `12/12`

A chevron that cannot move stays in place and goes quiet, so the number does not jump

A single written focus leaves the control out

The row is the badge and the prose

Back still walks older written comments, newest first

Forward still returns toward now

The badge and the prose stay as they are

## Source

Draw the focus pager in `FocusBlocks` in `src/window/client/sidebar.tsx`. When more than one written page is open, the focus row is one line inside `.focus-block`: the badge on the left, `.focus-pager` on the right with the form `< n/count >`, both chevrons present, `data-focus="back"` and `data-focus="forward"`, current page `pageCount - index`, count `pageCount`, and a chevron that cannot move `disabled` and quiet. A single written page renders no `.focus-pager`; the block is then the badge and the prose.

Keep Back and Forward in client memory in `src/window/client/main.tsx`: Back increments the index, Forward decrements it, a quiet chevron does not fire the click, and the listener bounds stay the backstop. Leave `writtenFocusPages` in `src/window/focus.ts`, the badge, `focusBlockProse`, adapters, the machine, the spine, and scenario links untouched unless a wiring fix is required for pager clicks.

Record the control on the badge row in `src/window/FACE.md` in the session that draws it; hairline and quiet-chevron measures stay in `src/window/face.css`. Remove the words «назад» and «вперёд» from the drawn control.

Seams (no child issues): page list in `focus.ts` vs drawn control in `FocusBlocks`; client page index in `main.tsx` vs redraw; badge and prose vs pager on one row; quiet chevron vs click walk; look in `FACE.md` and `face.css` vs behavior.

## Proof

`src/window/sidebar.test.ts` observes the rendered `FocusBlocks`: the control form, count from the oldest page, a chevron that stays and goes quiet, a single written focus with the control left out, the row then being the badge and the prose, Back, Forward, and the badge and the prose staying as they are.

The one-file command is the check on each attempt; the layer command and the type check run once after that command exits 0.

- `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- `pnpm test`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
`pnpm run test:types`
