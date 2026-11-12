sdd-absorbed: e51e36369ca7899f

## Verification boundary

`focus-pager`. Scenarios are observed on the focus block the sidebar draws. The rounds, the chevron icon, the characters `<` and `>` not being the mark, the count between the rounds, a round that stays in place and goes quiet, one written focus leaving the pager out, the count from the oldest page, Back, Forward, and the badge and the prose staying as they are are the rendered `FocusBlocks` in `src/window/sidebar.test.ts`. Opening on the latest page is the rendered sidebar in `src/window/board.test.ts`. The one-file command passes `--reporter=default` so that file can exit 0. The layer command keeps the coverage reporter.

one-file: `pnpm exec vitest --run --reporter=default <test-file>`
layer: `pnpm test`

fast suite: none
`pnpm run test:types`
trace: `spec`, `requirement`, and `scenario` from `@ojson/spec-coverage`
test path: `src/**/*.test.ts` or `src/**/*.test.tsx`

## External contracts

none

## Technical prerequisites

none

## Approach

The seams are the ones `CONTEXT-MAP.md` already names. The window draws the focus block and does not rewrite the written prose. The round is the control the window glossary already names. Play on the card is `Glyph` name `play` on `button.round` in `src/window/client/board.tsx`, and `button.round.play.off` when it cannot act. This change uses that face. It does not add a context.

The drawn control stays `FocusBlocks` in `src/window/client/sidebar.tsx`. When more than one page is open, the focus row is one line: the badge on the left, `.focus-pager` on the right. Back and forward are `button.round`. Each holds a chevron icon and no word. The characters `<` and `>` are not the mark. The count stays the span `.focus-pager-count` between the two rounds, still `pageCount - index` over `pageCount`, so the latest page reads `12/12`. One written focus still renders no `.focus-pager`. The block is then the badge and the prose.

A round that cannot move stays in the control and goes quiet the way a disabled play does: class `off` and the `disabled` attribute. On the latest page that is forward. On the oldest page that is back. The buttons keep `data-focus="back"` and `data-focus="forward"`. They are not `button.quiet`, and they are not class `play`.

The chevron marks sit in `src/window/client/marks.tsx`, beside `Glyph`: one icon pointing back and one pointing forward, the same 16×16 svg, `currentColor`, `aria-hidden`. The door's code glyph stays the door's.

The walk stays client memory in `src/window/client/main.tsx`. Back still increments the index. Forward still decrements it. Opening still passes no index, so the first paint is the latest page. A quiet round does not fire the click, because the listener already ignores a disabled button. The click does not post. Which comment is a page stays `src/window/focus.ts`.

`.round` is 22px, so `.focus-row` aligns the badge, the rounds, and the count on the center of the line. The count keeps the monospaced muted face. The rule `.focus-pager .quiet[disabled]` leaves with the quiet buttons. Measures stay the existing `.round`. No new colour and no new circle.

The drawing session updates `src/window/FACE.md` and the Round entry in `src/window/CONTEXT.md`: the pager's back and forward join the rounds, and the focus-block sentence stops naming the form `< n/count >`.

After merge the control is that row. No flag and no follow-up step.

Rejected: the characters `<` and `>` as the mark. Rejected: a new circle. Rejected: a word on the round, including «назад» and «вперёд». Rejected: changing the door, the close, the pill, or the gate signs. Rejected: removing a round that cannot move. Rejected: the count outside the two rounds. Rejected: the pager on one written focus. Rejected: the door's code glyph as the pager's icon. Rejected: class `play` on the pager. Rejected: a server round-trip for Back or Forward.

## Open decisions

none
