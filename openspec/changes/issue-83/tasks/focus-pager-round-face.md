- One control on the focus row, opposite the badge, shows a back chevron, the current page and the count, and a forward chevron, in the form `< 11/12 >`
- The focus pager's back and forward controls are rounds
- Each round holds a chevron icon
- The characters `<` and `>` are not the mark
- The count stays between the two rounds
- The count runs from the oldest page, so the latest page reads `12/12`
- The badge and the prose stay as they are

sdd-delta: ce50ed28804c49ad

## Source

Add chevron marks in `src/window/client/marks.tsx` beside `Glyph`: one icon back, one forward, 16×16 svg, `currentColor`, `aria-hidden`; the door's code glyph stays the door's. In `src/window/client/sidebar.tsx`, `FocusBlocks` keeps one `.focus-pager` on the focus row opposite the badge when more than one page is open: back and forward are `button.round`, each holds a chevron and no word; the count stays `span.focus-pager-count` between the rounds with `pageCount - index` over `pageCount`; buttons keep `data-focus="back"` and `data-focus="forward"` and are not `button.quiet` or class `play`. Align the row with existing `.round` at 22px. Drop the rule `.focus-pager .quiet[disabled]` when quiet buttons leave. Update `src/window/FACE.md` and the Round entry in `src/window/CONTEXT.md` so the pager's back and forward join the rounds and the focus-block sentence stops naming the form `< n/count >`. Leave `src/window/client/main.tsx` walk, quiet boundaries, and single-focus absence to later slices. Leave the door, close, pill, and gate signs untouched.

Seams (no child issues): chevron glyphs in `marks.tsx` vs pager drawing in `sidebar.tsx` vs play-on-card `button.round` face reuse vs glossary/FACE copy vs client index walk handled in later tasks.

## Proof

`src/window/sidebar.test.ts` observes the rendered `FocusBlocks`: one control on the focus row opposite the badge with back and forward chevrons each in a round and the count between; rounds not a new circle; chevron icons not words; `<` and `>` not the mark; count placement and `12/12` on the latest page; badge and prose unchanged beside the pager.

- **On each attempt** (while the test is red and after each edit to the test or its sources): `pnpm exec vitest --run --reporter=default src/window/sidebar.test.ts`
- **Once** after that command exits 0: `pnpm test`; then `pnpm run test:types`

Trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`.
